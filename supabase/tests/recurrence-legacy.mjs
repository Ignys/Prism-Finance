import assert from "node:assert/strict";

const userId = "10000000-0000-0000-0000-000000000077";
const preservedTables = ["transactions", "transaction_details", "transaction_attachments", "transaction_tags", "ledger_entries"];

async function capture(database, migrated = false) {
    const result = {};
    for (const table of preservedTables) {
        // Backfill and canonical recomputation legitimately touch update stamps.
        const baseExpression = table === "transactions" || table === "ledger_entries" ? "to_jsonb(t) - 'updated_at'" : "to_jsonb(t)";
        const expression = table === "transactions" && migrated ? `${baseExpression} - 'occurrence_number' - 'commitment' - 'routing_override'` : baseExpression;
        result[table] = (await database.query(`select ${expression} as row from public.${table} t where user_id=$1 order by (${expression})::text`, [userId])).rows;
    }
    return result;
}

/** Seed the actual pre-recurrence schema, including twelve existing future rows. */
export async function seedLegacyRecurrences(database) {
    await database.exec(`
        insert into auth.users(id,email) values ('${userId}','legacy-recurrence@example.test');
        insert into public.profiles(id,display_name,email) values ('${userId}','Legacy recurrence','legacy-recurrence@example.test');
        insert into public.wallets(user_id,id,name,icon,type,color,initial_balance,balance,created_at)
            values ('${userId}','legacy-wallet','Conta','wallet','checking','#000',1000,1000,'2020-01-01');
        insert into public.credit_cards(user_id,id,name,icon,color,credit_limit,closing_day,due_day,created_at)
            values ('${userId}','legacy-card','Cartão','card','#000',2000,10,17,'2020-01-01');
        insert into public.transaction_groups(user_id,id,beneficiary_name,category_name,title,type,transaction_mode,total_amount,credit_card_id,source_wallet_id,recurrence_rule,created_at)
            values ('${userId}','legacy-future','Eu','Serviços','Assinatura','expense','recurring',1200,'legacy-card',null,'{"anchorDate":"2090-01-05","amount":100,"interval":1}','2020-01-01'),
                ('${userId}','legacy-history','Eu','Serviços','Histórico','expense','recurring',100,null,'legacy-wallet','{"anchorDate":"2020-01-05","amount":100,"interval":1}','2020-01-01');
        insert into public.credit_card_invoices(user_id,id,credit_card_id,cycle_key,closing_date,due_date,total_amount,status,created_at,updated_at)
            select '${userId}','invoice-legacy-card-' || to_char(d,'YYYY-MM'),'legacy-card',to_char(d,'YYYY-MM'),d+9,d+16,100,'open','2020-01-01','2020-01-01'
            from (select (date '2090-01-01' + make_interval(months => n))::date as d from generate_series(0,11) n) months;
        insert into public.transactions(user_id,id,group_id,amount,scheduled_date,status,invoice_id,title,notes,created_at)
            select '${userId}','legacy-future-' || n,'legacy-future',case when n=3 then 145 else 100 end,
                (date '2090-01-05' + make_interval(months => n-1))::date + case when n=3 then 2 else 0 end,
                case when n=4 then 'skipped' when n=5 then 'cancelled' else 'pending' end,
                'invoice-legacy-card-' || to_char(date '2090-01-01' + make_interval(months => n-1),'YYYY-MM'),
                case when n=3 then 'Override individual' else null end,case when n=3 then 'Nota preservada' else null end,'2020-01-01'
            from generate_series(1,12) n;
        insert into public.transactions(user_id,id,group_id,amount,scheduled_date,status,paid_at,created_at)
            values ('${userId}','legacy-paid','legacy-history',100,'2020-01-05','paid','2020-01-07T12:00:00Z','2020-01-01');
        insert into public.tags(user_id,id,name,created_at) values ('${userId}','legacy-tag','Preservar','2020-01-01');
        insert into public.transaction_tags(user_id,transaction_id,tag_id) values ('${userId}','legacy-future-3','legacy-tag');
        insert into public.transaction_details(user_id,transaction_id,annotation) values ('${userId}','legacy-future-3','Detalhes da ocorrência');
        insert into public.transaction_attachments(user_id,id,transaction_id,file_name,storage_path,size_bytes)
            values ('${userId}','legacy-attachment','legacy-future-3','receipt.pdf','${userId}/receipt.pdf',100);
        -- February was individually moved into March. The old horizon still
        -- contains twelve rows, with two in March and none dated in February.
        update public.transactions set scheduled_date='2090-03-08', title='Moved February'
            where user_id='${userId}' and id='legacy-future-2';
    `);
    return capture(database);
}

export async function validateLegacyRecurrences(database, before) {
    assert.deepEqual(await capture(database, true), before, "migration must preserve transaction data, overrides, tags, details, files and ledger");
    const rows = (await database.query("select id, occurrence_number, commitment, routing_override from public.transactions where user_id=$1 order by id", [userId])).rows;
    assert.ok(rows.every((row) => row.routing_override === false), "legacy routing inheritance remains unchanged");
    for (let number = 1; number <= 12; number++) {
        const row = rows.find((item) => item.id === `legacy-future-${number}`);
        assert.equal(row.occurrence_number, number);
        assert.equal(row.commitment, number === 4 || number === 5 ? "posted" : "forecast");
    }
    assert.equal(rows.find((item) => item.id === "legacy-paid").commitment, "posted");
    const invoiceTotal = await database.query("select sum(total_amount)::float as total from public.credit_card_invoices where user_id=$1", [userId]);
    assert.equal(invoiceTotal.rows[0].total, 0, "legacy forecast horizon must release artificial card commitment");
    await database.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`);
    const current = await database.query("select * from public.project_recurring_occurrences('2090-01-01','2090-12-31') where group_id='legacy-future'");
    assert.equal(current.rows.length, 0, "twelve old materialized slots must not be projected again");
    const future = await database.query("select * from public.project_recurring_occurrences('2091-01-01','2091-12-31') where group_id='legacy-future'");
    assert.equal(future.rows.length, 12, "indefinite rules remain available beyond the legacy horizon");
    const sync = await database.query("select revision, updated_by from public.finance_sync_state where user_id=auth.uid()");
    assert.equal(sync.rows[0].updated_by, "migration:recurrence-v2");
    assert.ok(Number(sync.rows[0].revision) > 0);
    await database.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
    console.log("LEGACY RECURRENCE OK twelve rows preserved without duplicate forecasts; paid ledger, overrides, tags, annotations and attachments unchanged");
}
