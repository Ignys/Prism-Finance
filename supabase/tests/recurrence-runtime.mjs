import assert from "node:assert/strict";

export async function validateRecurrenceRuntime(database, expectDatabaseError) {
    const userId = "10000000-0000-0000-0000-000000000088";
    await database.exec(`reset role; insert into auth.users(id,email) values ('${userId}','recurrence@example.test');
        insert into public.profiles(id,display_name,email) values ('${userId}','Recurrence','recurrence@example.test');
        set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`);
    let revision = 0;
    const apply = async (upserts, deletes = []) => {
        const result = await database.query("select public.apply_finance_changes($1,$2::jsonb,'recurrence-test') as result", [revision, JSON.stringify({ protocol_version: 2, preferences: { planning: {} }, upserts, deletes })]);
        revision = Number(result.rows[0].result.revision);
        return result.rows[0].result;
    };
    const group = { id: "recur", beneficiary_name: "Eu", category_name: "Serviços", title: "Assinatura", type: "expense", transaction_mode: "recurring", total_amount: 0,
        credit_card_id: "recur-card", created_at: "2026-01-01T12:00:00Z", recurrence_rule: {
            seriesId: "recur", frequency: "monthly", interval: 1, anchorDate: "2026-01-31", amount: 100, startNumber: 1, end: { type: "count", count: 6 }, tagIds: [], excludedDates: [], notes: null,
        } };
    await apply({ wallets: [{ id: "recur-wallet", name: "Conta", icon: "wallet", type: "checking", initial_balance: 1000, balance: 1000, currency: "BRL", color: "#000", is_active: true, include_in_main_totals: true, created_at: group.created_at }],
        credit_cards: [{ id: "recur-card", name: "Cartão", icon: "card", color: "#000", credit_limit: 2000, closing_day: 10, due_day: 17, is_active: true, created_at: group.created_at }], transaction_groups: [group] });
    const projected = await database.query("select * from public.project_recurring_occurrences('2026-01-01','2026-12-31') order by occurrence_number");
    await database.exec("reset role");
    const foreignWallet = (await database.query("select w.id from public.wallets w where w.user_id<>$1 and not exists(select 1 from public.wallets own where own.user_id=$1 and own.id=w.id) limit 1", [userId])).rows[0];
    assert.ok(foreignWallet, "fixture must contain another owner's wallet");
    await database.exec("set role authenticated");
    await expectDatabaseError(() => apply({ transaction_groups: [{ ...group,
        recurrence_rule: { ...group.recurrence_rule, sourceWalletId: foreignWallet.id },
    }] }), "RECURRENCE_ROUTING_REFERENCE_INVALID");
    for (const key of ["sourceWalletId", "destinationWalletId", "creditCardId"]) {
        await expectDatabaseError(() => apply({ transaction_groups: [{ ...group,
            recurrence_rule: { ...group.recurrence_rule, [key]: "missing-or-other-owner" },
        }] }), "RECURRENCE_ROUTING_REFERENCE_INVALID");
    }
    await expectDatabaseError(() => apply({ transaction_groups: [{ ...group,
        recurrence_rule: { ...group.recurrence_rule, tagIds: ["missing-tag"] },
    }] }), "RECURRENCE_TAG_REFERENCE_INVALID");
    for (const invalidRule of [
        { amount: 0.001 }, { amount: "NaN" }, { interval: 1.5 }, { startNumber: 1.5 },
        { stopNumber: 2.5 }, { end: { type: "count", count: 2.5 } },
        { tagIds: {} }, { tagIds: [7] }, { excludedDates: ["2026-02-30"] },
        { anchorDate: "2026-2-1" }, { anchorDate: "infinity" }, { end: { type: "until", date: "2026-02-30" } },
    ]) {
        await expectDatabaseError(() => apply({ transaction_groups: [{ ...group,
            recurrence_rule: { ...group.recurrence_rule, ...invalidRule },
        }] }), "INVALID_RECURRENCE_RULE");
    }
    assert.equal((await database.query("select revision from public.finance_sync_state where user_id=auth.uid()")).rows[0].revision, revision, "invalid rules must roll back the entire sync revision");
    assert.deepEqual(projected.rows.map((row) => Number(row.amount)), [100, 100, 100, 100, 100, 100]);
    assert.deepEqual(projected.rows.slice(0, 3).map((row) => new Date(row.scheduled_date).toISOString().slice(0, 10)), ["2026-01-31", "2026-02-28", "2026-03-31"]);
    await database.query("select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false)");
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where group_id='recur'")).rows[0].count, 0, "projection cannot reveal another owner's rules");
    await database.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    assert.equal((await database.query("select count(*)::int as count from public.transactions")).rows[0].count, 0);
    assert.equal((await database.query("select revision from public.finance_sync_state where user_id=auth.uid()")).rows[0].revision, revision);
    const occurrence = { id: "occurrence-recur-1", group_id: "recur", occurrence_number: 1, amount: 100, scheduled_date: "2026-01-31", status: "pending", commitment: "forecast", created_at: group.created_at };
    await apply({ transactions: [occurrence] });
    const legacyPayload = { ...occurrence };
    delete legacyPayload.commitment;
    await apply({ transactions: [legacyPayload] });
    assert.equal((await database.query("select commitment from public.transactions where id=$1", [occurrence.id])).rows[0].commitment, "forecast", "old clients must not implicitly confirm forecasts");
    assert.equal(Number((await database.query("select sum(total_amount) as total from public.credit_card_invoices")).rows[0].total), 0);
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31')")).rows[0].count, 5);
    await expectDatabaseError(() => apply({ transactions: [{ ...occurrence, id: "invalid-number", occurrence_number: 7 }] }), "RECURRENCE_OCCURRENCE_OUTSIDE_RULE");
    await apply({ transactions: [{ ...occurrence, commitment: "posted" }] });
    assert.equal(Number((await database.query("select sum(total_amount) as total from public.credit_card_invoices")).rows[0].total), 100);
    assert.equal((await database.query("select count(*)::int as count from public.ledger_entries")).rows[0].count, 0);
    const invoiceId = "invoice-recur-card-2026-02";
    const paymentGroup = { id: "recur-payment", beneficiary_name: "Eu", category_name: "Fatura", title: "Pagamento", type: "expense", transaction_mode: "single", total_amount: 100, source_wallet_id: "recur-wallet", created_at: group.created_at };
    const payment = { id: "recur-payment-tx", group_id: paymentGroup.id, amount: 40, scheduled_date: "2026-02-17", status: "paid", paid_at: "2026-02-17T12:00:00Z", payment_for_invoice_id: invoiceId, created_at: group.created_at };
    await apply({ transaction_groups: [paymentGroup], transactions: [payment] });
    const partial = (await database.query("select paid_amount, total_amount, status from public.credit_card_invoices where id=$1", [invoiceId])).rows[0];
    assert.equal(Number(partial.paid_amount), 40);
    assert.equal(Number(partial.total_amount) - Number(partial.paid_amount), 60);
    assert.equal(partial.status, "open");
    await expectDatabaseError(() => apply({ transactions: [{ ...occurrence, commitment: "posted", amount: 120 }] }), "PAID_INVOICE_CHARGE_IMMUTABLE");
    const remainingPayment = { ...payment, id: "recur-payment-rest", amount: 60 };
    await apply({ transactions: [remainingPayment] });
    assert.equal(Number((await database.query("select sum(amount) as amount from public.ledger_entries where transaction_id in ($1,$2)", [payment.id, remainingPayment.id])).rows[0].amount), -100);
    assert.equal((await database.query("select status from public.credit_card_invoices where id=$1", [invoiceId])).rows[0].status, "paid");
    const overpaymentGroup = { ...paymentGroup, id: "recur-overpayment" };
    const overpayment = { ...payment, id: "recur-overpayment-tx", group_id: overpaymentGroup.id, amount: 1 };
    await expectDatabaseError(() => apply({ transaction_groups: [overpaymentGroup], transactions: [overpayment] }), "INVOICE_OVERPAYMENT");
    assert.equal((await database.query("select count(*)::int as count from public.transactions where id=$1", [overpayment.id])).rows[0].count, 0, "overpayment commit must roll back its transaction");
    await apply({ transactions: [{ ...occurrence, commitment: "posted", credit_card_id: group.credit_card_id, title: "Updated description" }] });
    assert.equal((await database.query("select title from public.transactions where id=$1", [occurrence.id])).rows[0].title, "Updated description", "metadata edits may make inherited routing explicit without changing paid history");
    await expectDatabaseError(() => apply({ transactions: [{ ...occurrence, commitment: "posted", scheduled_date: "2026-03-25", invoice_id: invoiceId }] }), "PAID_INVOICE_CHARGE_IMMUTABLE");
    await expectDatabaseError(() => apply({ transactions: [{ ...occurrence, id: "extra-charge", occurrence_number: 2, commitment: "posted", invoice_id: invoiceId }] }), "PAID_INVOICE_REQUIRES_PAYMENT_REVERSAL");
    await expectDatabaseError(() => apply({ transactions: [{ ...occurrence, commitment: "posted", status: "paid" }] }), "PAID_INVOICE_CHARGE_IMMUTABLE");
    const explicitlySelectedInvoiceId = "invoice-recur-card-2026-04";
    const openInvoiceCharge = { ...occurrence, id: "open-invoice-charge", occurrence_number: 2, commitment: "posted", scheduled_date: "2026-03-25", invoice_id: explicitlySelectedInvoiceId };
    await apply({
        credit_card_invoices: [{ id: explicitlySelectedInvoiceId, credit_card_id: group.credit_card_id, cycle_key: "2026-04", closing_date: "2026-03-10", due_date: "2026-04-17", total_amount: 0, paid_amount: 0, status: "open", created_at: group.created_at }],
        transactions: [openInvoiceCharge],
    });
    await apply({ transactions: [{ ...openInvoiceCharge, scheduled_date: "2026-01-31", invoice_id: explicitlySelectedInvoiceId }] });
    assert.deepEqual(
        (await database.query("select scheduled_date::text, invoice_id from public.transactions where id=$1", [openInvoiceCharge.id])).rows[0],
        { scheduled_date: "2026-01-31", invoice_id: explicitlySelectedInvoiceId },
        "an explicit open invoice must take precedence over the date-based paid cycle",
    );
    // Explicitly reverse payment before amending its purchase history.
    await apply({}, [{ entity_type: "transaction", entity_id: remainingPayment.id }]);
    assert.equal(Number((await database.query("select paid_amount from public.credit_card_invoices where id=$1", [invoiceId])).rows[0].paid_amount), 40);
    assert.equal((await database.query("select count(*)::int as count from public.ledger_entries where transaction_id=$1", [remainingPayment.id])).rows[0].count, 0);
    await apply({}, [{ entity_type: "transaction", entity_id: payment.id }, { entity_type: "transaction_group", entity_id: paymentGroup.id }]);
    await apply({ transactions: [{ ...occurrence, commitment: "posted", scheduled_date: "2026-03-25", invoice_id: null }] });
    assert.equal((await database.query("select invoice_id, scheduled_date from public.transactions where id=$1", [occurrence.id])).rows[0].invoice_id, "invoice-recur-card-2026-04");
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-01-31')")).rows[0].count, 0);

    const overrideGroup = { ...group, id: "wallet-override", credit_card_id: null, source_wallet_id: "recur-wallet",
        recurrence_rule: { ...group.recurrence_rule, startNumber: 3, stopNumber: 2, anchorDate: "2026-03-31" } };
    const override = { ...occurrence, id: "occurrence-recur-3", group_id: overrideGroup.id, occurrence_number: 3, scheduled_date: "2026-03-31", commitment: "forecast" };
    await apply({ transaction_groups: [overrideGroup], transactions: [override] });
    assert.equal((await database.query("select invoice_id from public.transactions where id=$1", [override.id])).rows[0].invoice_id, null);
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where occurrence_number=3")).rows[0].count, 0, "routing overrides retain global occurrence identity");

    for (const type of ["income", "expense"]) {
        const walletGroup = { ...paymentGroup, id: `wallet-${type}`, title: type, type, total_amount: 50 };
        const pending = { id: `wallet-${type}-tx`, group_id: walletGroup.id, amount: 50, scheduled_date: "2026-08-15", status: "pending", created_at: group.created_at };
        await apply({ transaction_groups: [walletGroup], transactions: [pending] });
        const paid = { ...pending, status: "paid", paid_at: "2026-09-05T16:00:00Z" };
        await apply({ transactions: [paid] });
        await apply({ transactions: [{ ...paid, paid_at: "2026-09-06T16:00:00Z" }] });
        const ledger = await database.query("select amount, created_at from public.ledger_entries where transaction_id=$1", [paid.id]);
        assert.equal(ledger.rows.length, 1);
        assert.equal(Number(ledger.rows[0].amount), type === "income" ? 50 : -50);
        assert.equal(new Date(ledger.rows[0].created_at).toISOString(), "2026-09-05T16:00:00.000Z");
        assert.equal((await database.query("select scheduled_date::text from public.transactions where id=$1", [paid.id])).rows[0].scheduled_date, pending.scheduled_date);
        if (type === "expense") {
            await expectDatabaseError(() => apply({ transactions: [{ ...paid, routing_override: true,
                source_wallet_id: null, credit_card_id: "recur-card" }] }), "CARD_CHARGE_REQUIRES_INVOICE_PAYMENT");
            assert.equal((await database.query("select credit_card_id from public.transactions where id=$1", [paid.id])).rows[0].credit_card_id, null,
                "a paid wallet expense cannot become an individually paid card charge");
        }
    }
    const removedOverride = { ...occurrence, id: "deleted-override", occurrence_number: 4, scheduled_date: "2026-05-09", commitment: "forecast" };
    await apply({ transactions: [removedOverride] });
    await database.exec("reset role");
    await database.query("delete from public.transactions where id=$1", [removedOverride.id]);
    await database.exec("set role authenticated");
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where group_id='recur' and occurrence_number=4")).rows[0].count, 0, "direct override deletion must not recreate its original slot");
    await database.exec("reset role");
    await database.query("delete from public.transaction_groups where id=$1", [overrideGroup.id]);
    await database.exec("set role authenticated");
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where group_id='recur' and occurrence_number=3")).rows[0].count, 0, "group cascade must preserve deletion intent in the surviving series");
    assert.equal((await database.query("select count(*)::int as count from public.project_recurring_occurrences('2026-01-01','2026-12-31') where group_id='recur' and occurrence_number in (5,6)")).rows[0].count, 2, "unrelated future slots remain available");
    const currentRule = (await database.query("select recurrence_rule from public.transaction_groups where id=$1", [group.id])).rows[0].recurrence_rule;
    const jsonRoutedGroup = { ...group, recurrence_rule: { ...currentRule, sourceWalletId: "recur-wallet" } };
    await apply({ transaction_groups: [jsonRoutedGroup] });
    await database.exec("reset role");
    await expectDatabaseError(() => database.query("delete from public.wallets where user_id=$1 and id='recur-wallet'", [userId]), "RECURRENCE_ROUTING_REFERENCE_INVALID");
    await database.exec("set role authenticated");
    assert.equal((await database.query("select count(*)::int as count from public.wallets where id='recur-wallet'")).rows[0].count, 1, "failed JSON-reference deletion rolls back the wallet and all cascades");
    await apply({ transaction_groups: [{ ...jsonRoutedGroup, recurrence_rule: { ...currentRule, sourceWalletId: null } }] }, [{ entity_type: "wallet", entity_id: "recur-wallet" }]);
    assert.equal((await database.query("select count(*)::int as count from public.wallets where id='recur-wallet'")).rows[0].count, 0, "removing the reference and wallet in one commit is allowed");
    console.log("RECURRENCE OK pure period projection, month-end/count, forecast limit, confirmation, paid invoice/routing guards, date reassignment, wallet settlement idempotency, direct/cascade deletion exclusions, atomic JSON reference removal");
}
