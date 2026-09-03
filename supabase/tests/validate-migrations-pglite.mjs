import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const database = new PGlite({ extensions: { pgcrypto } });

await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create table auth.users (
        id uuid primary key,
        aud text,
        role text,
        email text,
        encrypted_password text,
        email_confirmed_at timestamptz,
        created_at timestamptz,
        updated_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;

    create schema storage;
    create table storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false,
        file_size_limit bigint
    );
    create table storage.objects (
        id bigint generated always as identity primary key,
        bucket_id text not null,
        name text not null
    );
    create function storage.foldername(value text) returns text[] language sql immutable as $$
        select string_to_array(value, '/')
    $$;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated;

    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
`);

const migrationNames = [
    "001_initial_finance_schema.sql",
    "002_transaction_overrides.sql",
    "003_finance_sync_revision.sql",
    "004_transaction_details_and_attachments.sql",
    "005_family_security.sql",
    "006_finance_integrity_and_versions.sql",
    "007_atomic_incremental_finance_rpc.sql",
    "008_attachment_deletion_queue.sql",
    "009_financial_ledger_invariants_and_views.sql",
    "010_invoice_payment_projection.sql",
    "011_correct_composite_foreign_keys.sql",
    "012_cascaded_change_tracking.sql",
    "013_family_shared_wishlists.sql",
    "014_family_share_realtime.sql",
    "015_batched_finance_commits.sql",
    "016_pgcrypto_function_search_path.sql",
    "017_fix_ledger_transaction_delete.sql",
];

for (const migrationName of migrationNames) {
    if (migrationName === "006_finance_integrity_and_versions.sql") {
        await database.exec(`
            insert into auth.users(id, email, created_at, updated_at)
            values ('10000000-0000-0000-0000-000000000099', 'legacy@example.test', now(), now());
            insert into public.profiles(id, display_name, email)
            values ('10000000-0000-0000-0000-000000000099', 'Legacy', 'legacy@example.test');
            insert into public.transaction_groups(
                user_id, id, beneficiary_name, category_name, title, type,
                transaction_mode, total_amount, installment_count, created_at
            ) values (
                '10000000-0000-0000-0000-000000000099', 'legacy-zero-installment-group',
                'Legacy', 'Legacy', 'Legacy installment', 'expense',
                'installment', 10, 0, now()
            );
            insert into public.transactions(
                user_id, id, group_id, installment_number, amount,
                scheduled_date, status, created_at
            ) values (
                '10000000-0000-0000-0000-000000000099', 'legacy-zero-installment-transaction',
                'legacy-zero-installment-group', 0, 10, current_date, 'pending', now()
            );
        `);
    }
    if (migrationName === "016_pgcrypto_function_search_path.sql") {
        // Reproduce an existing deployment created by the original 005/007:
        // pgcrypto is in Supabase's extensions schema, while the functions can
        // only resolve public and pg_temp. Migration 016 must repair both.
        await database.exec(`
            alter function public.create_family_invite(uuid, integer)
                set search_path = public, pg_temp;
            alter function public.apply_finance_changes_rowwise(bigint, jsonb, text)
                set search_path = public, pg_temp;
        `);
    }
    const sql = await readFile(join(projectRoot, "supabase", "migrations", migrationName), "utf8");
    await database.exec(sql);
    if (migrationName === "001_initial_finance_schema.sql") {
        // Match Supabase, which keeps pgcrypto outside the public schema.
        await database.exec("alter extension pgcrypto set schema extensions");
    }
    console.log(`MIGRATION OK ${migrationName}`);
}

const normalizedLegacyInstallments = await database.query(`
    select g.installment_count, t.installment_number
      from public.transaction_groups g
      join public.transactions t on t.user_id = g.user_id and t.group_id = g.id
     where g.id = 'legacy-zero-installment-group'
`);
if (
    normalizedLegacyInstallments.rows[0]?.installment_count !== null ||
    normalizedLegacyInstallments.rows[0]?.installment_number !== null
) {
    throw new Error("legacy non-positive installment values were not normalized");
}

await database.exec(`
    insert into auth.users(id, email, created_at, updated_at)
    values
        ('10000000-0000-0000-0000-000000000001', 'owner@example.test', now(), now()),
        ('10000000-0000-0000-0000-000000000002', 'member@example.test', now(), now());
    insert into public.profiles(id, display_name, email)
    values
        ('10000000-0000-0000-0000-000000000001', 'Owner', 'owner@example.test'),
        ('10000000-0000-0000-0000-000000000002', 'Member', 'member@example.test');
    set role authenticated;
    select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
`);

async function expectDatabaseError(action, expectedFragment) {
    try {
        await action();
    } catch (error) {
        if (String(error.message).includes(expectedFragment)) {
            return;
        }
        throw error;
    }
    throw new Error(`expected database error containing ${expectedFragment}`);
}

async function applyChanges(expectedRevision, changes, clientId) {
    const result = await database.query(
        "select public.apply_finance_changes($1, $2::jsonb, $3) as commit",
        [expectedRevision, JSON.stringify({ protocol_version: 2, ...changes }), clientId],
    );
    return result.rows[0]?.commit;
}

const familyResult = await database.query("select public.create_family('Runtime validation') as family_id");
if (!familyResult.rows[0]?.family_id) {
    throw new Error("create_family did not return a family id");
}
const familyId = familyResult.rows[0].family_id;
const inviteResult = await database.query("select public.create_family_invite($1::uuid, 24) as invite", [familyId]);
const inviteCode = inviteResult.rows[0]?.invite?.code;
await database.query("select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false)");
await database.query("select public.accept_family_invite($1)", [inviteCode]);
const memberRole = await database.query("select role from public.family_members where user_id = auth.uid()");
if (memberRole.rows[0]?.role !== "member") {
    throw new Error("accepted invitation did not create a regular member");
}
await expectDatabaseError(
    () => database.query("update public.family_members set role = 'admin' where user_id = auth.uid()"),
    "permission denied",
);
await database.query("select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false)");

const commit = await applyChanges(0, {
    preferences: { planning: {} },
    upserts: {
        wallets: [{
            id: "wallet-runtime", name: "Wallet", icon: "wallet", type: "checking",
            balance: 999, initial_balance: 100, currency: "BRL", color: "#000000",
            is_active: true, include_in_main_totals: true, created_at: "2026-01-01T00:00:00Z",
        }],
        categories: [{
            id: "wishlist-category", parent_id: null, name: "Objetivos", type: "expense", icon: "star",
            color: "#123456", is_active: true, is_system: false, sort_order: 0, created_at: "2026-01-01T00:00:00Z",
        }],
        wish_items: [{
            id: "shared-wish", value: 250, category_id: "wishlist-category", priority: "2",
            description: "Shared goal", link: null, image_url: null, is_active: true, created_at: "2026-01-01T00:00:00Z",
        }],
    },
    deletes: [],
}, "pglite-runtime");
if (Number(commit?.revision) !== 1 || Number(commit?.changes?.changes?.wallets?.[0]?.balance) !== 100 || commit?.snapshot) {
    throw new Error(`unexpected canonical commit: ${JSON.stringify(commit)}`);
}
await database.query("select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false)");
const familyContextResult = await database.query("select public.get_current_family_context() as context");
const ownerWishlist = familyContextResult.rows[0]?.context?.shared_wishlists?.find(
    (wishlist) => wishlist.owner.uid === "10000000-0000-0000-0000-000000000001",
);
const directWishlistResult = await database.query("select count(*)::integer as count from public.wish_items");
const shareRevisionResult = await database.query("select revision from public.family_share_sync_state where family_id = $1", [familyId]);
if (ownerWishlist?.items?.length !== 1 || directWishlistResult.rows[0]?.count !== 0 || Number(shareRevisionResult.rows[0]?.revision) < 1) {
    throw new Error("family sharing either bypassed RLS or omitted its scoped wishlist/revision projection");
}
await database.query("select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false)");
await expectDatabaseError(
    () => applyChanges(0, { preferences: { planning: {} }, upserts: {}, deletes: [] }, "stale-runtime"),
    "FINANCE_REVISION_CONFLICT:1",
);

const invoiceCommit = await applyChanges(1, {
    preferences: { planning: {} },
    upserts: {
        credit_cards: [{
            id: "card-runtime", name: "Card", icon: "card", color: "#111111", credit_limit: 1000,
            closing_day: 10, due_day: 17, bank_wallet_id: null, is_active: true, created_at: "2026-01-01T00:00:00Z",
        }],
        transaction_groups: [{
            id: "purchase-group", beneficiary_name: "Owner", category_name: "Compras", title: "Compra",
            type: "expense", transaction_mode: "single", total_amount: 50,
            credit_card_id: "card-runtime", created_at: "2026-01-01T00:00:00Z",
        }],
        credit_card_invoices: [{
            id: "invoice-runtime", credit_card_id: "card-runtime", cycle_key: "2026-01",
            closing_date: "2026-01-10", due_date: "2026-01-17", total_amount: 0,
            paid_amount: 0, status: "open", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
        }],
        transactions: [{
            id: "purchase-runtime", group_id: "purchase-group", amount: 50, scheduled_date: "2026-01-05",
            status: "pending", invoice_id: "invoice-runtime", credit_card_id: "card-runtime", created_at: "2026-01-01T00:00:00Z",
        }],
    },
    deletes: [],
}, "invoice-runtime");
if (Number(invoiceCommit?.changes?.changes?.credit_card_invoices?.[0]?.total_amount) !== 50) {
    throw new Error("invoice total was not derived from purchase transactions");
}

const paymentNote = "[prism-invoice-payment]|invoice-runtime|card-runtime";
const paymentCommit = await applyChanges(2, {
    preferences: { planning: {}, favorite_wallet_id: "wallet-runtime" },
    upserts: {
        transaction_groups: [{
            id: "payment-group", beneficiary_name: "Owner", category_name: "Fatura", title: "Pagamento",
            notes: paymentNote, type: "expense", transaction_mode: "single", total_amount: 50,
            source_wallet_id: "wallet-runtime", created_at: "2026-01-17T00:00:00Z",
        }],
        transactions: [{
            id: "payment-runtime", group_id: "payment-group", amount: 50, scheduled_date: "2026-01-17",
            status: "paid", paid_at: "2026-01-17T12:00:00Z", payment_for_invoice_id: "invoice-runtime",
            created_at: "2026-01-17T00:00:00Z",
        }],
    },
    deletes: [],
}, "payment-runtime");
const paidInvoice = paymentCommit?.changes?.changes?.credit_card_invoices?.find((invoice) => invoice.id === "invoice-runtime");
const paidWallet = paymentCommit?.changes?.changes?.wallets?.find((wallet) => wallet.id === "wallet-runtime");
const paidTransaction = paymentCommit?.changes?.changes?.transactions?.find((transaction) => transaction.id === "payment-runtime");
if (
    paidInvoice?.status !== "paid" ||
    Number(paidInvoice?.paid_amount) !== 50 ||
    Number(paidWallet?.balance) !== 50 ||
    paidTransaction?.payment_for_invoice_id !== "invoice-runtime"
) {
    throw new Error("invoice payment did not derive invoice and wallet projections");
}
await expectDatabaseError(
    () => applyChanges(3, {
        preferences: { planning: {} },
        upserts: {
            transaction_groups: [{
                id: "overpay-group", beneficiary_name: "Owner", category_name: "Fatura", title: "Overpay",
                notes: paymentNote, type: "expense", transaction_mode: "single", total_amount: 1,
                created_at: "2026-01-18T00:00:00Z",
            }],
            transactions: [{
                id: "overpay-runtime", group_id: "overpay-group", amount: 1, scheduled_date: "2026-01-18",
                status: "paid", paid_at: "2026-01-18T12:00:00Z", payment_for_invoice_id: "invoice-runtime",
                created_at: "2026-01-18T00:00:00Z",
            }],
        },
        deletes: [],
    }, "overpay-runtime"),
    "INVOICE_OVERPAYMENT",
);
await expectDatabaseError(
    () => applyChanges(3, {
        preferences: { planning: {} },
        upserts: {
            transaction_groups: [{
                id: "forged-total-group", beneficiary_name: "Owner", category_name: "Teste", title: "Forged total",
                type: "expense", transaction_mode: "single", total_amount: 999, created_at: "2026-01-18T00:00:00Z",
            }],
        },
        deletes: [],
    }, "forged-total-runtime"),
    "TRANSACTION_GROUP_TOTAL_MISMATCH",
);
await expectDatabaseError(
    () => applyChanges(3, {
        preferences: { planning: {} },
        upserts: { ledger_entries: [{ id: "forged-ledger" }] },
        deletes: [],
    }, "forged-ledger-runtime"),
    "FINANCE_LEDGER_IS_SERVER_MANAGED",
);
await database.query(`
    insert into public.transaction_attachments(
        user_id, id, transaction_id, file_name, storage_path, mime_type, size_bytes
    ) values (
        auth.uid(), 'attachment-runtime', 'payment-runtime', 'receipt.pdf',
        auth.uid()::text || '/payment-runtime/receipt.pdf', 'application/pdf', 100
    )
`);

const deleteCommit = await applyChanges(3, {
    preferences: { planning: {}, favorite_wallet_id: "wallet-runtime" },
    upserts: {},
    deletes: [{ entity_type: "wallet", entity_id: "wallet-runtime" }],
}, "delete-runtime");
const reopenedInvoice = deleteCommit?.changes?.changes?.credit_card_invoices?.find((invoice) => invoice.id === "invoice-runtime");
const cascadedTombstone = deleteCommit?.changes?.changes?.tombstones?.find(
    (item) => item.entity_type === "transaction" && item.entity_id === "payment-runtime",
);
const attachmentQueueResult = await database.query(
    "select count(*)::integer as count from public.attachment_deletion_queue where storage_path like '%receipt.pdf'",
);
if (
    reopenedInvoice?.status !== "open" ||
    !cascadedTombstone ||
    Number(cascadedTombstone.version) !== 4 ||
    attachmentQueueResult.rows[0]?.count !== 1
) {
    throw new Error("wallet cascade did not reopen the invoice, publish tombstones, and queue attachment cleanup");
}
const cascadePageResult = await database.query("select public.load_finance_changes(3, 1) as changes");
const cascadePage = cascadePageResult.rows[0]?.changes;
const pageInvoice = cascadePage?.changes?.credit_card_invoices?.find((invoice) => invoice.id === "invoice-runtime");
const pageTombstone = cascadePage?.changes?.tombstones?.find(
    (item) => item.entity_type === "transaction" && item.entity_id === "payment-runtime",
);
if (
    Number(cascadePage?.until_revision) !== 4 ||
    pageInvoice?.status !== "open" ||
    cascadePage?.changes?.preferences?.favorite_wallet_id !== null ||
    !pageTombstone
) {
    throw new Error("incremental page omitted a cascade projection or dependent tombstone");
}

await applyChanges(4, {
    preferences: { planning: {} },
    upserts: {
        wallets: [{
            id: "protected-wallet", name: "Protected", icon: "wallet", type: "checking",
            balance: 10, initial_balance: 10, currency: "BRL", color: "#222222",
            is_active: true, include_in_main_totals: true, created_at: "2026-01-20T00:00:00Z",
        }],
    },
    deletes: [],
}, "legacy-protection-setup");
await database.query(
    "select public.save_finance_snapshot(5, $1::jsonb, 'legacy-runtime')",
    [JSON.stringify({ preferences: { planning: {} }, wallets: [] })],
);
const protectedWallet = await database.query("select count(*)::integer as count from public.wallets where id = 'protected-wallet'");
if (protectedWallet.rows[0]?.count !== 1) {
    throw new Error("legacy empty snapshot deleted a canonical wallet");
}
await applyChanges(6, {
    preferences: { planning: {} },
    upserts: {},
    deletes: [{ entity_type: "wallet", entity_id: "protected-wallet" }],
}, "legacy-resurrection-setup");
await database.query(
    "select public.save_finance_snapshot(7, $1::jsonb, 'legacy-runtime')",
    [JSON.stringify({
        preferences: { planning: {} },
        wallets: [{
            id: "protected-wallet", name: "Stale", icon: "wallet", type: "checking",
            balance: 10, initial_balance: 10, currency: "BRL", color: "#222222",
            is_active: true, include_in_main_totals: true, created_at: "2026-01-20T00:00:00Z",
        }],
    })],
);
const resurrectedWallet = await database.query("select count(*)::integer as count from public.wallets where id = 'protected-wallet'");
if (resurrectedWallet.rows[0]?.count !== 0) {
    throw new Error("legacy stale snapshot resurrected a tombstoned wallet");
}
await database.exec(`
    reset role;
    update public.finance_sync_state
       set revision = 9, updated_at = now(), updated_by = 'unlogged-runtime-gap'
     where user_id = '10000000-0000-0000-0000-000000000001';
    set role authenticated;
    select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
`);
const gapResult = await database.query("select public.load_finance_changes(8, 50) as changes");
if (gapResult.rows[0]?.changes?.requires_full_reload !== true) {
    throw new Error("unlogged revision gap did not require a full reload");
}

const snapshotResult = await database.query("select public.load_finance_snapshot() as snapshot");
if (Number(snapshotResult.rows[0]?.snapshot?.revision) !== 9) {
    throw new Error("atomic snapshot did not expose revision 9");
}

await database.exec(`
    reset role;
    insert into auth.users(id, email, created_at, updated_at)
    values ('10000000-0000-0000-0000-000000000003', 'volume@example.test', now(), now());
    insert into public.profiles(id, display_name, email)
    values ('10000000-0000-0000-0000-000000000003', 'Volume', 'volume@example.test');
    set role authenticated;
    select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
`);

const bulkSize = 500;
const bulkGroups = Array.from({ length: bulkSize }, (_, index) => ({
    id: `bulk-group-${String(index).padStart(4, "0")}`,
    beneficiary_name: "Volume",
    category_name: "Income",
    title: `Income ${index}`,
    type: "income",
    transaction_mode: "single",
    total_amount: 1,
    source_wallet_id: "bulk-wallet",
    created_at: "2026-01-01T00:00:00Z",
}));
const bulkTransactions = Array.from({ length: bulkSize }, (_, index) => ({
    id: `bulk-tx-${String(index).padStart(4, "0")}`,
    group_id: `bulk-group-${String(index).padStart(4, "0")}`,
    amount: 1,
    scheduled_date: "2026-01-01",
    status: "paid",
    paid_at: "2026-01-01T12:00:00Z",
    created_at: "2026-01-01T12:00:00Z",
}));
const bulkStartedAt = performance.now();
const bulkCommit = await applyChanges(0, {
    preferences: { planning: {}, favorite_wallet_id: "bulk-wallet" },
    upserts: {
        wallets: [{
            id: "bulk-wallet", name: "Bulk", icon: "wallet", type: "checking", balance: 0,
            initial_balance: 0, currency: "BRL", color: "#000000", is_active: true,
            include_in_main_totals: true, created_at: "2026-01-01T00:00:00Z",
        }],
        transaction_groups: bulkGroups,
        transactions: bulkTransactions,
    },
    deletes: [],
}, "bulk-runtime");
const bulkElapsedMs = performance.now() - bulkStartedAt;
const bulkLedgerCount = await database.query(`
    select count(*)::integer as count, max(balance_after)::numeric as final_balance
      from public.ledger_entries
     where user_id = auth.uid() and wallet_id = 'bulk-wallet'
`);
if (
    Number(bulkCommit?.revision) !== 1 ||
    bulkCommit?.snapshot ||
    bulkLedgerCount.rows[0]?.count !== bulkSize ||
    Number(bulkLedgerCount.rows[0]?.final_balance) !== bulkSize
) {
    throw new Error("batched high-volume commit produced an invalid projection");
}

const compactCommit = await applyChanges(1, {
    preferences: { planning: {}, favorite_wallet_id: "bulk-wallet" },
    upserts: {
        transactions: [{
            ...bulkTransactions[bulkSize - 1],
            amount: 2,
        }],
    },
    deletes: [],
}, "compact-runtime");
if (
    compactCommit?.snapshot ||
    compactCommit?.changes?.changes?.transactions?.length !== 1 ||
    Number(compactCommit?.changes?.changes?.wallets?.[0]?.balance) !== bulkSize + 1
) {
    throw new Error("an incremental commit returned more than its canonical changed rows");
}

const legacyShapeResult = await database.query(
    "select public.apply_finance_changes(2, $1::jsonb, 'old-browser-runtime') as commit",
    [JSON.stringify({ preferences: { planning: {}, favorite_wallet_id: "bulk-wallet" }, upserts: {}, deletes: [] })],
);
if (Number(legacyShapeResult.rows[0]?.commit?.snapshot?.revision) !== 3) {
    throw new Error("a pre-015 browser did not receive its compatible snapshot response");
}

const directTransactionDeleteCommit = await applyChanges(3, {
    preferences: { planning: {}, favorite_wallet_id: "bulk-wallet" },
    upserts: {},
    deletes: [
        { entity_type: "transaction", entity_id: "bulk-tx-0000" },
        { entity_type: "transaction_group", entity_id: "bulk-group-0000" },
    ],
}, "direct-transaction-delete-runtime");
const directlyDeletedRows = await database.query(`
    select
        (select count(*)::integer from public.transactions where id = 'bulk-tx-0000') as transaction_count,
        (select count(*)::integer from public.ledger_entries where transaction_id = 'bulk-tx-0000') as ledger_count
`);
if (
    Number(directTransactionDeleteCommit?.revision) !== 4 ||
    directlyDeletedRows.rows[0]?.transaction_count !== 0 ||
    directlyDeletedRows.rows[0]?.ledger_count !== 0
) {
    throw new Error("direct paid transaction deletion did not cascade its server-managed ledger projection");
}

console.log(`RUNTIME OK family RLS/share, CAS, batched ${bulkSize}-row projection (${bulkElapsedMs.toFixed(0)}ms), compact commits, cascades, direct transaction deletion, tombstones, safe legacy adapter, gap fallback and atomic load`);
await database.close();
