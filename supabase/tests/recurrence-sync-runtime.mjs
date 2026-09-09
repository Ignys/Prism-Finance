import assert from "node:assert/strict";
import { createServer } from "vite";

/** Exercise the production TS merger/mappers against the actual SQL writer. */
export async function validateRecurrenceSyncRuntime(database, projectRoot, expectDatabaseError) {
    const runtime = await createServer({ root: projectRoot, configFile: false, envDir: false,
        optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom" });
    try {
        const { fixtureGroup, fixtureSnapshot, fixtureCard, fixtureTransaction, fixtureWallet } = await runtime.ssrLoadModule("/src/context/finance/financeTestFixtures.ts");
        const { requireRecurrenceRule } = await runtime.ssrLoadModule("/src/context/finance/recurrence/rule.ts");
        const { materializeOccurrence } = await runtime.ssrLoadModule("/src/context/finance/recurrence/materializeOccurrence.ts");
        const { occurrenceId, occurrenceDate } = await runtime.ssrLoadModule("/src/context/finance/recurrence/projectOccurrences.ts");
        const { updateTransactionSeriesSnapshot } = await runtime.ssrLoadModule("/src/context/finance/transactionSeries/updateTransactionSeriesSnapshot.ts");
        const { deleteTransactionsSnapshot } = await runtime.ssrLoadModule("/src/context/finance/transactionSeries/deleteTransactions.ts");
        const { applyTransactionStatus } = await runtime.ssrLoadModule("/src/context/finance/transactionStatus.ts");
        const { mergeSupabaseFinanceData } = await runtime.ssrLoadModule("/src/context/finance/financeSyncMerge.ts");
        const { toWalletRow, toCreditCardRow, toTransactionGroupRow, toTransactionRow } = await runtime.ssrLoadModule("/src/supabase/finance/financeRowMappers.ts");
        const userId = "10000000-0000-0000-0000-000000000066";
        await database.exec(`reset role; insert into auth.users(id,email) values ('${userId}','sync-recurrence@example.test');
            insert into public.profiles(id,display_name,email) values ('${userId}','Sync recurrence','sync-recurrence@example.test');
            set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`);
        let revision = 0;
        const apply = async (snapshot, expectedRevision = revision) => {
            const result = await database.query("select public.apply_finance_changes($1,$2::jsonb,'domain-sync-test') as result", [expectedRevision, JSON.stringify({ protocol_version: 2,
                upserts: { wallets: snapshot.wallets.map((item) => toWalletRow(userId, item)), credit_cards: snapshot.creditCards.map((item) => toCreditCardRow(userId, item)), transaction_groups: snapshot.transactionGroups.map((item) => toTransactionGroupRow(userId, item)),
                    transactions: snapshot.transactions.map((item) => toTransactionRow(userId, item)) } })]);
            revision = Number(result.rows[0].result.revision);
        };
        const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "count", count: 6 } }) });
        const base = { ...fixtureSnapshot([group], []), favoriteWalletId: null };
        const edit = (snapshot, number, amount, revisionId) => {
            const id = occurrenceId(group.id, number);
            return { ...updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(snapshot, id), transactionId: id, draft: { amount }, scope: "this_and_next",
                wasProjected: true, createGroupId: () => revisionId, now: "2026-01-01T12:00:00Z" }).snapshot, favoriteWalletId: null };
        };
        await apply(base);
        const baseRevision = revision;
        const remote = edit(base, 3, 120, "remote-revision");
        await apply(remote);
        const target = edit(base, 5, 150, "local-revision");
        await expectDatabaseError(() => apply(target, baseRevision), "FINANCE_REVISION_CONFLICT");
        const merged = mergeSupabaseFinanceData({ baseData: base, remoteData: remote, targetData: target });
        await apply(merged);
        const projected = await database.query("select amount::float as amount from public.project_recurring_occurrences('2026-01-01','2026-12-31') order by occurrence_number");
        assert.deepEqual(projected.rows.map((item) => item.amount), [100, 100, 120, 120, 150, 150]);
        assert.equal((await database.query("select count(*)::int as count from public.transactions")).rows[0].count, 0);

        const paidId = occurrenceId(group.id, 5);
        const remotePaid = { ...applyTransactionStatus(materializeOccurrence(merged, paidId), paidId, "paid", "2026-09-05T12:00:00.000Z"), favoriteWalletId: null };
        await apply(remotePaid);
        const localEdit = edit(merged, 3, 180, "local-after-payment");
        let preserved = mergeSupabaseFinanceData({ baseData: merged, remoteData: remotePaid, targetData: localEdit });
        await apply(preserved);
        const paid = (await database.query("select amount::float as amount,status,paid_at from public.transactions where id=$1", [paidId])).rows[0];
        assert.equal(paid.amount, 150);
        assert.equal(paid.status, "paid");
        assert.equal(new Date(paid.paid_at).toISOString(), "2026-09-05T12:00:00.000Z");
        assert.equal((await database.query("select count(*)::int as count from public.ledger_entries where transaction_id=$1", [paidId])).rows[0].count, 1);

        const remoteExcluded = { ...preserved, transactionGroups: preserved.transactionGroups.map((item) => ({ ...item,
            recurrenceRule: { ...item.recurrenceRule, excludedDates: [occurrenceDate(item.recurrenceRule, 4)] },
        })) };
        await apply(remoteExcluded);
        const selectedId = occurrenceId(group.id, 3);
        const movedOffline = { ...updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(preserved, selectedId), transactionId: selectedId,
            draft: { scheduledDate: "2026-03-20" }, scope: "this_and_next", wasProjected: true, createGroupId: () => "offline-date-edit" }).snapshot, favoriteWalletId: null };
        preserved = mergeSupabaseFinanceData({ baseData: preserved, remoteData: remoteExcluded, targetData: movedOffline });
        await apply(preserved);
        assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where occurrence_number=4")).rows[0].count, 0, "offline date revision retains remotely excluded slot");
        const ended = deleteTransactionsSnapshot(preserved, occurrenceId(group.id, 6), "this_and_next");
        await apply(ended);
        const stale = materializeOccurrence(preserved, occurrenceId(group.id, 6));
        const staleMerged = mergeSupabaseFinanceData({ baseData: preserved, remoteData: { ...ended, favoriteWalletId: null }, targetData: { ...stale, favoriteWalletId: null } });
        await expectDatabaseError(() => apply(staleMerged), "RECURRENCE_OCCURRENCE_OUTSIDE_RULE");
        assert.equal((await database.query("select count(*)::int as count from public.transactions where occurrence_number=6")).rows[0].count, 0);
        const purchaseGroup = fixtureGroup({ id: "purchase-routing", transactionMode: "installment", installmentCount: 3, totalAmount: 300, creditCardId: fixtureCard.id, sourceWalletId: null });
        const installments = [1,2,3].map((number) => fixtureTransaction({ id: `routing-installment-${number}`, groupId: purchaseGroup.id,
            installmentNumber: number, scheduledDate: "2026-01-15", commitment: "posted" }));
        const purchase = { ...ended, transactionGroups: [...ended.transactionGroups, purchaseGroup], transactions: [...ended.transactions, ...installments] };
        await apply(purchase);
        const converted = updateTransactionSeriesSnapshot({ snapshot: purchase, transactionId: installments[1].id, scope: "single",
            draft: { paymentMethod: "wallet", walletId: fixtureWallet.id, status: "paid" }, now: "2026-09-05T12:00:00Z" }).snapshot;
        await apply(converted);
        const routed = (await database.query("select routing_override,invoice_id,credit_card_id from public.transactions where id=$1", [installments[1].id])).rows[0];
        assert.equal(routed.routing_override, true);
        assert.equal(routed.invoice_id, null);
        assert.equal(routed.credit_card_id, null);
        assert.equal((await database.query("select effective_credit_card_id from public.effective_transactions where id=$1", [installments[1].id])).rows[0].effective_credit_card_id, null);
        const cash = (await database.query("select amount::float as amount,wallet_id from public.ledger_entries where transaction_id=$1", [installments[1].id])).rows;
        assert.deepEqual(cash, [{ amount: -100, wallet_id: fixtureWallet.id }]);
        const oldPayload = toTransactionRow(userId, converted.transactions.find((item) => item.id === installments[1].id));
        delete oldPayload.routing_override;
        await database.query("select public.apply_finance_changes($1,$2::jsonb,'legacy-routing-test')", [revision, JSON.stringify({ protocol_version: 2, upserts: { transactions: [oldPayload] } })]);
        assert.equal((await database.query("select routing_override from public.transactions where id=$1", [installments[1].id])).rows[0].routing_override, true, "old payloads must not restore inherited routing");
        assert.equal((await database.query("select count(*)::int as count from public.ledger_entries where transaction_id=$1", [installments[1].id])).rows[0].count, 1);
        console.log("RECURRENCE SYNC OK production TS rebase/mappers through CAS writer; no overlapping slots; paid history and ledger preserved; ended series rejects stale materialization");
    } finally {
        await runtime.close();
    }
}
