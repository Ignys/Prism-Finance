begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
    ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now()),
    ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member@example.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles(id, display_name, email)
values
    ('10000000-0000-0000-0000-000000000001', 'Owner', 'owner@example.test'),
    ('10000000-0000-0000-0000-000000000002', 'Member', 'member@example.test')
on conflict (id) do nothing;

create temporary table test_context(family_id uuid, invite_code text);
grant all on table test_context to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

insert into test_context(family_id)
select public.create_family('Teste seguro');

select is(
    (select role from public.family_members where user_id = auth.uid()),
    'admin',
    'the family creator is the active admin'
);

update test_context
   set invite_code = (public.create_family_invite(family_id, 24) ->> 'code');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select throws_ok(
    $$select public.accept_family_invite('CODE-THAT-DOES-NOT-EXIST')$$,
    'P0001',
    'FAMILY_INVITE_INVALID_OR_EXPIRED',
    'joining without a valid invite is rejected'
);

select lives_ok(
    format('select public.accept_family_invite(%L)', (select invite_code from test_context)),
    'a valid invite can be accepted once'
);

select is(
    (select role from public.family_members where user_id = auth.uid()),
    'member',
    'an accepted invite always creates a regular member'
);

select throws_ok(
    $$update public.family_members set role = 'admin' where user_id = auth.uid()$$,
    '42501',
    'permission denied for table family_members',
    'a member cannot promote itself directly'
);

select is(
    (select role from public.family_members where user_id = auth.uid()),
    'member',
    'the failed promotion leaves the role unchanged'
);

select throws_ok(
    format('select public.create_family_invite(%L::uuid, 24)', (select family_id from test_context)),
    '42501',
    'FAMILY_ADMIN_REQUIRED',
    'a regular member cannot create invitations'
);

select throws_ok(
    $$select public.accept_family_invite('CODE-THAT-DOES-NOT-EXIST')$$,
    'P0001',
    'FAMILY_ALREADY_ACTIVE_MEMBER',
    'an active member cannot join a second family'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
    (public.apply_finance_changes(
        0,
        jsonb_build_object(
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'wallets', jsonb_build_array(jsonb_build_object(
                    'id', 'wallet-test', 'name', 'Wallet', 'icon', 'wallet', 'type', 'checking',
                    'balance', 999, 'initial_balance', 100, 'currency', 'BRL', 'color', '#000000',
                    'is_active', true, 'include_in_main_totals', true, 'created_at', now()
                )),
                'categories', jsonb_build_array(jsonb_build_object(
                    'id', 'category-wish', 'parent_id', null, 'name', 'Objetivos', 'type', 'expense',
                    'icon', 'star', 'color', '#123456', 'is_active', true, 'is_system', false,
                    'sort_order', 0, 'created_at', now()
                )),
                'wish_items', jsonb_build_array(jsonb_build_object(
                    'id', 'wish-shared', 'value', 250, 'category_id', 'category-wish', 'priority', '2',
                    'description', 'Objetivo compartilhado', 'link', null, 'image_url', null,
                    'is_active', true, 'created_at', now()
                ))
            ),
            'deletes', '[]'::jsonb
        ),
        'pgtap'
    ) ->> 'revision')::bigint,
    1::bigint,
    'the first incremental mutation advances the revision'
);

select is(
    (select balance from public.wallets where user_id = auth.uid() and id = 'wallet-test'),
    100.00::numeric,
    'wallet balance is derived by PostgreSQL instead of trusting the client'
);

select throws_ok(
    $$select public.apply_finance_changes(0, '{"preferences":{"planning":{}},"upserts":{},"deletes":[]}'::jsonb, 'stale')$$,
    'P0001',
    'FINANCE_REVISION_CONFLICT:1',
    'a stale writer cannot overwrite a newer revision'
);

select is(
    (public.load_finance_snapshot() ->> 'revision')::bigint,
    1::bigint,
    'the atomic loader returns the committed revision'
);

select is(
    jsonb_array_length(public.load_finance_snapshot() #> '{data,wallets}'),
    1,
    'the atomic loader returns all wallet rows in the same snapshot'
);

select is(
    (public.apply_finance_changes(
        1,
        jsonb_build_object(
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'credit_cards', jsonb_build_array(jsonb_build_object(
                    'id', 'card-test', 'name', 'Card', 'icon', 'card', 'color', '#111111',
                    'credit_limit', 1000, 'closing_day', 10, 'due_day', 17,
                    'bank_wallet_id', null, 'is_active', true, 'created_at', now()
                )),
                'transaction_groups', jsonb_build_array(jsonb_build_object(
                    'id', 'group-test', 'beneficiary_name', 'Member', 'category_name', 'Compras',
                    'title', 'Compra', 'type', 'expense', 'transaction_mode', 'single',
                    'total_amount', 50, 'credit_card_id', 'card-test', 'created_at', now()
                )),
                'credit_card_invoices', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-test', 'credit_card_id', 'card-test', 'cycle_key', '2026-01',
                    'closing_date', '2026-01-10', 'due_date', '2026-01-17',
                    'total_amount', 0, 'paid_amount', 0, 'status', 'open',
                    'created_at', now(), 'updated_at', now()
                )),
                'transactions', jsonb_build_array(jsonb_build_object(
                    'id', 'transaction-test', 'group_id', 'group-test', 'amount', 50,
                    'scheduled_date', '2026-01-05', 'status', 'pending',
                    'invoice_id', 'invoice-test', 'credit_card_id', 'card-test', 'created_at', now()
                ))
            ),
            'deletes', '[]'::jsonb
        ),
        'invoice-test'
    ) ->> 'revision')::bigint,
    2::bigint,
    'a related card purchase is committed atomically'
);

select is(
    (select total_amount from public.credit_card_invoices where user_id = auth.uid() and id = 'invoice-test'),
    50.00::numeric,
    'invoice total is derived from its transactions'
);

select is(
    (public.apply_finance_changes(
        2,
        jsonb_build_object(
            'protocol_version', 2,
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'credit_card_invoices', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-test', 'credit_card_id', 'card-test', 'cycle_key', '2026-01',
                    'closing_date', '2026-01-10', 'due_date', '2026-01-17',
                    'total_amount', 50, 'paid_amount', 50, 'status', 'paid',
                    'paid_at', now(), 'created_at', now(), 'updated_at', now()
                )),
                'transaction_groups', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-payment-group', 'beneficiary_name', 'Owner', 'category_name', 'Fatura',
                    'title', 'Pagamento da fatura', 'notes', '[prism-invoice-payment]|invoice-test|card-test',
                    'type', 'expense', 'transaction_mode', 'single', 'total_amount', 50,
                    'source_wallet_id', 'wallet-test', 'created_at', now()
                )),
                'transactions', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-payment-transaction', 'group_id', 'invoice-payment-group', 'amount', 50,
                    'scheduled_date', '2026-01-17', 'status', 'paid', 'paid_at', now(),
                    'payment_for_invoice_id', 'invoice-test', 'created_at', now()
                ))
            ),
            'deletes', '[]'::jsonb
        ),
        'invoice-payment-test'
    ) #>> '{changes,changes,credit_card_invoices,0,status}'),
    'paid',
    'the commit returns the canonical paid invoice state'
);

select is(
    (select paid_amount from public.credit_card_invoices where user_id = auth.uid() and id = 'invoice-test'),
    50.00::numeric,
    'invoice paid amount is derived from linked payment transactions'
);

select is(
    (select payment_for_invoice_id from public.transactions where user_id = auth.uid() and id = 'invoice-payment-transaction'),
    'invoice-test',
    'the atomic RPC persists the relational invoice payment link'
);

select is(
    (public.apply_finance_changes(
        3,
        jsonb_build_object(
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'wallets', (select jsonb_agg(jsonb_build_object(
                    'id', 'wallet-page-' || n, 'name', 'Wallet ' || n, 'icon', 'wallet', 'type', 'checking',
                    'balance', 0, 'initial_balance', 0, 'currency', 'BRL', 'color', '#000000',
                    'is_active', true, 'include_in_main_totals', true, 'created_at', now()
                )) from generate_series(1, 1001) n)
            ),
            'deletes', '[]'::jsonb
        ),
        'pagination-test'
    ) ->> 'revision')::bigint,
    4::bigint,
    'a commit can atomically contain more than the PostgREST default row limit'
);

select is(
    jsonb_array_length(public.load_finance_snapshot() #> '{data,wallets}'),
    1002,
    'the snapshot loader does not truncate collections at 1000 rows'
);

select is(
    jsonb_array_length(public.load_finance_changes(3, 1) #> '{changes,wallets}'),
    1001,
    'incremental pagination keeps a complete revision together'
);

select is(
    (public.apply_finance_changes(
        4,
        '{"preferences":{"planning":{}},"upserts":{},"deletes":[{"entity_type":"wallet","entity_id":"wallet-page-1"}]}'::jsonb,
        'delete-test'
    ) ->> 'revision')::bigint,
    5::bigint,
    'an explicit delete commits as its own revision'
);

select is(
    (select count(*) from public.wallets where user_id = auth.uid() and id = 'wallet-page-1'),
    0::bigint,
    'the deleted entity is absent from the canonical table'
);

select is(
    jsonb_array_length(public.load_finance_changes(4, 1) #> '{changes,tombstones}'),
    1,
    'incremental readers receive the deletion tombstone'
);

select is(
    (public.apply_finance_changes(
        5,
        jsonb_build_object(
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'transaction_groups', jsonb_build_array(jsonb_build_object(
                    'id', 'income-group', 'beneficiary_name', 'Owner', 'category_name', 'Receita',
                    'title', 'Receita teste', 'type', 'income', 'transaction_mode', 'single',
                    'total_amount', 10, 'source_wallet_id', 'wallet-test', 'created_at', now()
                )),
                'transactions', jsonb_build_array(jsonb_build_object(
                    'id', 'income-transaction', 'group_id', 'income-group', 'amount', 10,
                    'scheduled_date', '2026-01-20', 'status', 'paid', 'paid_at', now(), 'created_at', now()
                ))
            ),
            'deletes', '[]'::jsonb
        ),
        'ledger-projection-test'
    ) ->> 'revision')::bigint,
    6::bigint,
    'a paid transaction commits without client-authored ledger rows'
);

select is(
    (select balance from public.wallets where user_id = auth.uid() and id = 'wallet-test'),
    60.00::numeric,
    'the server-generated ledger entry updates the wallet balance'
);

select is(
    (select effective_source_wallet_id from public.effective_transactions where user_id = auth.uid() and id = 'income-transaction'),
    'wallet-test',
    'the effective transaction view resolves group defaults once'
);

select throws_ok(
    $$update public.wallets set balance = 500 where user_id = auth.uid() and id = 'wallet-test'$$,
    '42501',
    'permission denied for table wallets',
    'authenticated clients cannot bypass financial RPCs'
);

select throws_ok(
    $$select public.apply_finance_changes(
        6,
        '{"preferences":{"planning":{}},"upserts":{"ledger_entries":[{"id":"forged-ledger"}]},"deletes":[]}'::jsonb,
        'forged-ledger-test'
    )$$,
    '22023',
    'FINANCE_LEDGER_IS_SERVER_MANAGED',
    'clients cannot author or delete server-owned ledger projections'
);

select is(
    (public.apply_finance_changes(
        6,
        '{"preferences":{"planning":{}},"upserts":{},"deletes":[{"entity_type":"wallet","entity_id":"wallet-test"}]}'::jsonb,
        'permanent-delete-test'
    ) ->> 'revision')::bigint,
    7::bigint,
    'permanent wallet deletion commits atomically'
);

select is(
    (select count(*) from public.transaction_groups where user_id = auth.uid() and id in ('income-group', 'invoice-payment-group')),
    0::bigint,
    'wallet deletion cascades to dependent transaction groups'
);

select is(
    (select count(*) from public.ledger_entries where user_id = auth.uid() and wallet_id = 'wallet-test'),
    0::bigint,
    'wallet deletion removes dependent ledger projections'
);

select is(
    (select status from public.credit_card_invoices where user_id = auth.uid() and id = 'invoice-test'),
    'open',
    'deleting an invoice payment dependency recomputes the invoice state'
);

select is(
    (select version from public.credit_card_invoices where user_id = auth.uid() and id = 'invoice-test'),
    7::bigint,
    'a projection changed by a cascade is stamped with the active revision'
);

select ok(
    exists (
        select 1
          from public.finance_tombstones
         where user_id = auth.uid()
           and entity_type = 'transaction'
           and entity_id = 'invoice-payment-transaction'
           and version = 7
    ),
    'cascaded dependent deletions publish tombstones for incremental clients'
);

set constraints transactions_prevent_invoice_overpayment, credit_card_invoices_prevent_overpayment immediate;
select throws_ok(
    $$select public.apply_finance_changes(
        7,
        jsonb_build_object(
            'preferences', jsonb_build_object('planning', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'transaction_groups', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-overpay-group', 'beneficiary_name', 'Owner', 'category_name', 'Fatura',
                    'title', 'Pagamento excessivo', 'notes', '[prism-invoice-payment]|invoice-test|card-test',
                    'type', 'expense', 'transaction_mode', 'single', 'total_amount', 51, 'created_at', now()
                )),
                'transactions', jsonb_build_array(jsonb_build_object(
                    'id', 'invoice-overpay-transaction', 'group_id', 'invoice-overpay-group', 'amount', 51,
                    'scheduled_date', '2026-01-18', 'status', 'paid', 'paid_at', now(),
                    'payment_for_invoice_id', 'invoice-test', 'created_at', now()
                ))
            ),
            'deletes', '[]'::jsonb
        ),
        'overpayment-test'
    )$$,
    '23514',
    'INVOICE_OVERPAYMENT',
    'payments above the canonical invoice total are rejected atomically'
);
set constraints transactions_prevent_invoice_overpayment, credit_card_invoices_prevent_overpayment deferred;

select throws_ok(
    $$update public.finance_sync_state set revision = revision + 1 where user_id = auth.uid()$$,
    '42501',
    'permission denied for table finance_sync_state',
    'authenticated clients cannot forge the synchronization revision'
);

reset role;
update public.finance_sync_state
   set revision = 8, updated_at = now(), updated_by = 'legacy-gap'
 where user_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
    (public.load_finance_changes(7, 50) ->> 'requires_full_reload')::boolean,
    true,
    'an unlogged legacy revision gap forces an atomic full reload'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is(
    (select count(*) from public.wallets),
    0::bigint,
    'RLS prevents a different family member from reading personal finance rows'
);

select is(
    (select count(*) from public.wish_items),
    0::bigint,
    'RLS does not expose another member personal wishlist table directly'
);

select is(
    (
        select jsonb_array_length(owner_list -> 'items')
          from jsonb_array_elements(public.get_current_family_context() -> 'shared_wishlists') owner_list
         where owner_list #>> '{owner,uid}' = '10000000-0000-0000-0000-000000000001'
    ),
    1,
    'the scoped family RPC exposes only the intended shared wishlist projection'
);

select ok(
    exists (select 1 from pg_constraint where conname = 'credit_card_invoices_amounts_check'),
    'invoice amount integrity is enforced by a database constraint'
);

select ok(
    exists (select 1 from pg_trigger where tgname = 'transaction_groups_validate_total' and not tgisinternal),
    'non-recurring group totals are guarded by a deferred database invariant'
);

select ok(
    exists (select 1 from pg_indexes where indexname = 'credit_card_invoices_user_card_cycle_uidx'),
    'invoice cycles have a uniqueness guarantee'
);

select ok(
    to_regclass('public.attachment_deletion_queue') is not null,
    'dependent Storage deletions have a durable queue'
);

select ok(
    exists (select 1 from pg_trigger where tgname = 'transaction_attachments_queue_blob_delete' and not tgisinternal),
    'attachment metadata cascades enqueue blob cleanup'
);

select * from finish();
rollback;
