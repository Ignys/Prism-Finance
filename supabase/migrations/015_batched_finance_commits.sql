-- Scale incremental commits by batching financial projections and returning
-- only the canonical rows changed by the committed revision.

create or replace function public.recompute_wallet_balances_batch(targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    active_revision bigint := coalesce(nullif(current_setting('prism.finance_revision', true), '')::bigint, 0);
begin
    create temporary table if not exists prism_dirty_wallets (
        user_id uuid not null,
        wallet_id text not null,
        primary key (user_id, wallet_id)
    ) on commit delete rows;
    truncate table prism_dirty_wallets;

    insert into prism_dirty_wallets(user_id, wallet_id)
    select distinct r.user_id, r.wallet_id
      from jsonb_to_recordset(coalesce(targets, '[]'::jsonb)) as r(user_id uuid, wallet_id text)
     where r.user_id is not null and nullif(r.wallet_id, '') is not null
    on conflict do nothing;

    if not exists (select 1 from prism_dirty_wallets) then
        return;
    end if;

    perform set_config('prism.skip_wallet_projection', 'on', true);

    with running_balances as (
        select le.user_id,
               le.id,
               w.initial_balance + sum(le.amount) over (
                   partition by le.user_id, le.wallet_id
                   order by le.created_at, le.id
                   rows between unbounded preceding and current row
               ) as calculated_balance
          from public.ledger_entries le
          join prism_dirty_wallets d on d.user_id = le.user_id and d.wallet_id = le.wallet_id
          join public.wallets w on w.user_id = le.user_id and w.id = le.wallet_id
    )
    update public.ledger_entries le
       set balance_after = rb.calculated_balance,
           version = greatest(le.version, active_revision),
           updated_at = now()
      from running_balances rb
     where le.user_id = rb.user_id
       and le.id = rb.id
       and le.balance_after is distinct from rb.calculated_balance;

    with wallet_totals as (
        select d.user_id,
               d.wallet_id,
               coalesce(sum(le.amount), 0) as ledger_total
          from prism_dirty_wallets d
          left join public.ledger_entries le
            on le.user_id = d.user_id and le.wallet_id = d.wallet_id
         group by d.user_id, d.wallet_id
    )
    update public.wallets w
       set balance = w.initial_balance + totals.ledger_total,
           version = greatest(w.version, active_revision),
           updated_at = now()
      from wallet_totals totals
     where w.user_id = totals.user_id
       and w.id = totals.wallet_id
       and w.balance is distinct from w.initial_balance + totals.ledger_total;

    perform set_config('prism.skip_wallet_projection', 'off', true);
end;
$$;

create or replace function public.sync_finance_transactions_batch(old_rows jsonb, new_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    active_revision bigint := coalesce(nullif(current_setting('prism.finance_revision', true), '')::bigint, 0);
    wallet_targets jsonb;
begin
    create temporary table if not exists prism_dirty_transactions (
        user_id uuid not null,
        transaction_id text not null,
        primary key (user_id, transaction_id)
    ) on commit delete rows;
    create temporary table if not exists prism_dirty_groups (
        user_id uuid not null,
        group_id text not null,
        primary key (user_id, group_id)
    ) on commit delete rows;
    create temporary table if not exists prism_dirty_invoices (
        user_id uuid not null,
        invoice_id text not null,
        primary key (user_id, invoice_id)
    ) on commit delete rows;
    create temporary table if not exists prism_projection_wallets (
        user_id uuid not null,
        wallet_id text not null,
        primary key (user_id, wallet_id)
    ) on commit delete rows;

    truncate table prism_dirty_transactions, prism_dirty_groups, prism_dirty_invoices, prism_projection_wallets;

    insert into prism_dirty_transactions(user_id, transaction_id)
    select distinct r.user_id, r.id
      from jsonb_to_recordset(coalesce(old_rows, '[]'::jsonb) || coalesce(new_rows, '[]'::jsonb))
           as r(user_id uuid, id text)
     where r.user_id is not null and nullif(r.id, '') is not null
    on conflict do nothing;

    insert into prism_dirty_groups(user_id, group_id)
    select distinct r.user_id, r.group_id
      from jsonb_to_recordset(coalesce(old_rows, '[]'::jsonb) || coalesce(new_rows, '[]'::jsonb))
           as r(user_id uuid, group_id text)
     where r.user_id is not null and nullif(r.group_id, '') is not null
    on conflict do nothing;

    insert into prism_dirty_invoices(user_id, invoice_id)
    select distinct r.user_id, invoice_ref.invoice_id
      from jsonb_to_recordset(coalesce(old_rows, '[]'::jsonb) || coalesce(new_rows, '[]'::jsonb))
           as r(user_id uuid, invoice_id text, payment_for_invoice_id text)
      cross join lateral unnest(array[r.invoice_id, r.payment_for_invoice_id]) as invoice_ref(invoice_id)
     where r.user_id is not null and nullif(invoice_ref.invoice_id, '') is not null
    on conflict do nothing;

    -- Capture old wallet dependencies before replacing generated ledger rows.
    insert into prism_projection_wallets(user_id, wallet_id)
    select distinct le.user_id, le.wallet_id
      from public.ledger_entries le
      join prism_dirty_transactions d
        on d.user_id = le.user_id and d.transaction_id = le.transaction_id
    on conflict do nothing;

    -- Capture current effective wallet dependencies as well.
    insert into prism_projection_wallets(user_id, wallet_id)
    select distinct t.user_id, wallet_ref.wallet_id
      from public.transactions t
      join prism_dirty_transactions d on d.user_id = t.user_id and d.transaction_id = t.id
      join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
      cross join lateral unnest(array[
          coalesce(t.source_wallet_id, g.source_wallet_id),
          coalesce(t.destination_wallet_id, g.destination_wallet_id)
      ]) as wallet_ref(wallet_id)
     where nullif(wallet_ref.wallet_id, '') is not null
    on conflict do nothing;

    perform set_config('prism.skip_wallet_projection', 'on', true);

    delete from public.ledger_entries le
     using prism_dirty_transactions d
     where le.user_id = d.user_id and le.transaction_id = d.transaction_id;

    insert into public.ledger_entries(
        user_id, id, wallet_id, transaction_id, invoice_id,
        amount, balance_after, description, created_at, updated_at, version
    )
    select canonical.user_id,
           canonical.entry_id,
           canonical.wallet_id,
           canonical.transaction_id,
           null,
           canonical.amount,
           0,
           canonical.description,
           canonical.entry_time,
           now(),
           active_revision
      from (
          select t.user_id,
                 case when g.type = 'transfer' then 'le-' || t.id || '-source' else 'le-' || t.id end as entry_id,
                 coalesce(t.source_wallet_id, g.source_wallet_id) as wallet_id,
                 t.id as transaction_id,
                 case
                     when g.type = 'income' then abs(t.amount)
                     else -abs(t.amount)
                 end as amount,
                 case
                     when g.type = 'income' then 'Receita: ' || coalesce(t.title, g.title)
                     when g.type = 'transfer' then 'Transferencia enviada: ' || coalesce(t.title, g.title)
                     else 'Despesa: ' || coalesce(t.title, g.title)
                 end as description,
                 coalesce(t.paid_at, t.created_at, now()) as entry_time
            from public.transactions t
            join prism_dirty_transactions d on d.user_id = t.user_id and d.transaction_id = t.id
            join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
           where t.status = 'paid'
             and coalesce(t.source_wallet_id, g.source_wallet_id) is not null
             and (g.type in ('income', 'transfer') or (g.type = 'expense' and coalesce(t.credit_card_id, g.credit_card_id) is null))

          union all

          select t.user_id,
                 'le-' || t.id || '-dest',
                 coalesce(t.destination_wallet_id, g.destination_wallet_id),
                 t.id,
                 abs(t.amount),
                 'Transferencia recebida: ' || coalesce(t.title, g.title),
                 coalesce(t.paid_at, t.created_at, now())
            from public.transactions t
            join prism_dirty_transactions d on d.user_id = t.user_id and d.transaction_id = t.id
            join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
           where t.status = 'paid'
             and g.type = 'transfer'
             and coalesce(t.destination_wallet_id, g.destination_wallet_id) is not null
             and coalesce(t.destination_wallet_id, g.destination_wallet_id)
                 <> coalesce(t.source_wallet_id, g.source_wallet_id)
      ) canonical;

    -- A rebuilt row supersedes the tombstone generated by its replacement.
    delete from public.finance_tombstones ts
     using public.ledger_entries le
     where ts.user_id = le.user_id
       and ts.entity_type = 'ledger_entry'
       and ts.entity_id = le.id
       and ts.related_id = ''
       and exists (
           select 1 from prism_dirty_transactions d
            where d.user_id = le.user_id and d.transaction_id = le.transaction_id
       );

    insert into prism_projection_wallets(user_id, wallet_id)
    select distinct le.user_id, le.wallet_id
      from public.ledger_entries le
      join prism_dirty_transactions d
        on d.user_id = le.user_id and d.transaction_id = le.transaction_id
    on conflict do nothing;

    with totals as (
        select d.user_id, d.group_id, coalesce(sum(abs(t.amount)), 0) as total_amount
          from prism_dirty_groups d
          left join public.transactions t on t.user_id = d.user_id and t.group_id = d.group_id
         group by d.user_id, d.group_id
    )
    update public.transaction_groups g
       set total_amount = totals.total_amount,
           version = greatest(g.version, active_revision),
           updated_at = now()
      from totals
     where g.user_id = totals.user_id
       and g.id = totals.group_id
       and g.transaction_mode in ('single', 'installment')
       and g.total_amount is distinct from totals.total_amount;

    with amounts as (
        select d.user_id,
               d.invoice_id,
               coalesce(sum(abs(t.amount)) filter (
                   where t.invoice_id = d.invoice_id and t.status not in ('cancelled', 'skipped')
               ), 0) as total_amount,
               coalesce(sum(abs(t.amount)) filter (
                   where t.payment_for_invoice_id = d.invoice_id and t.status = 'paid'
               ), 0) as paid_amount
          from prism_dirty_invoices d
          left join public.transactions t
            on t.user_id = d.user_id
           and (t.invoice_id = d.invoice_id or t.payment_for_invoice_id = d.invoice_id)
         group by d.user_id, d.invoice_id
    )
    update public.credit_card_invoices i
       set total_amount = amounts.total_amount,
           paid_amount = least(amounts.paid_amount, amounts.total_amount),
           status = case
               when amounts.total_amount > 0 and amounts.paid_amount = amounts.total_amount then 'paid'
               else 'open'
           end,
           paid_at = case
               when amounts.total_amount > 0 and amounts.paid_amount = amounts.total_amount then coalesce(i.paid_at, now())
               else null
           end,
           version = greatest(i.version, active_revision),
           updated_at = now()
      from amounts
     where i.user_id = amounts.user_id and i.id = amounts.invoice_id;

    select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'wallet_id', wallet_id)), '[]'::jsonb)
      into wallet_targets
      from prism_projection_wallets;
    perform set_config('prism.skip_wallet_projection', 'off', true);
    perform public.recompute_wallet_balances_batch(wallet_targets);
end;
$$;

create or replace function public.sync_wallet_balances_from_statement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    targets jsonb;
begin
    if current_setting('prism.skip_wallet_projection', true) = 'on' then
        return null;
    end if;

    if tg_op = 'INSERT' then
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'wallet_id', wallet_id)), '[]'::jsonb)
          into targets from new_ledger_rows;
    elsif tg_op = 'DELETE' then
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'wallet_id', wallet_id)), '[]'::jsonb)
          into targets from old_ledger_rows;
    else
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'wallet_id', wallet_id)), '[]'::jsonb)
          into targets
          from (
              select n.user_id, n.wallet_id
                from new_ledger_rows n
                join old_ledger_rows o on o.user_id = n.user_id and o.id = n.id
               where n.wallet_id is distinct from o.wallet_id
                  or n.amount is distinct from o.amount
                  or n.created_at is distinct from o.created_at
              union
              select o.user_id, o.wallet_id
                from new_ledger_rows n
                join old_ledger_rows o on o.user_id = n.user_id and o.id = n.id
               where n.wallet_id is distinct from o.wallet_id
                  or n.amount is distinct from o.amount
                  or n.created_at is distinct from o.created_at
          ) changed;
    end if;

    perform public.recompute_wallet_balances_batch(targets);
    return null;
end;
$$;

drop trigger if exists ledger_entries_sync_wallet_balance on public.ledger_entries;
drop trigger if exists ledger_entries_sync_wallet_balance_insert on public.ledger_entries;
drop trigger if exists ledger_entries_sync_wallet_balance_update on public.ledger_entries;
drop trigger if exists ledger_entries_sync_wallet_balance_delete on public.ledger_entries;
create trigger ledger_entries_sync_wallet_balance_insert
after insert on public.ledger_entries
referencing new table as new_ledger_rows
for each statement execute function public.sync_wallet_balances_from_statement();
create trigger ledger_entries_sync_wallet_balance_update
after update on public.ledger_entries
referencing old table as old_ledger_rows new table as new_ledger_rows
for each statement execute function public.sync_wallet_balances_from_statement();
create trigger ledger_entries_sync_wallet_balance_delete
after delete on public.ledger_entries
referencing old table as old_ledger_rows
for each statement execute function public.sync_wallet_balances_from_statement();

create or replace function public.sync_transactions_from_statement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    old_payload jsonb := '[]'::jsonb;
    new_payload jsonb := '[]'::jsonb;
begin
    if tg_op <> 'INSERT' then
        select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into old_payload from old_transaction_rows o;
    end if;
    if tg_op <> 'DELETE' then
        select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into new_payload from new_transaction_rows n;
    end if;

    if tg_op = 'UPDATE' then
        if not exists (
            select 1
              from old_transaction_rows o
              join new_transaction_rows n on n.user_id = o.user_id and n.id = o.id
             where n.group_id is distinct from o.group_id
                or n.amount is distinct from o.amount
                or n.status is distinct from o.status
                or n.paid_at is distinct from o.paid_at
                or n.invoice_id is distinct from o.invoice_id
                or n.payment_for_invoice_id is distinct from o.payment_for_invoice_id
                or n.source_wallet_id is distinct from o.source_wallet_id
                or n.destination_wallet_id is distinct from o.destination_wallet_id
                or n.credit_card_id is distinct from o.credit_card_id
                or n.title is distinct from o.title
        ) then
            return null;
        end if;
    end if;

    perform public.sync_finance_transactions_batch(old_payload, new_payload);
    return null;
end;
$$;

drop trigger if exists transactions_sync_ledger on public.transactions;
drop trigger if exists transactions_sync_invoice on public.transactions;
drop trigger if exists transactions_sync_group_total on public.transactions;
drop trigger if exists transactions_sync_projections_insert on public.transactions;
drop trigger if exists transactions_sync_projections_update on public.transactions;
drop trigger if exists transactions_sync_projections_delete on public.transactions;
create trigger transactions_sync_projections_insert
after insert on public.transactions
referencing new table as new_transaction_rows
for each statement execute function public.sync_transactions_from_statement();
create trigger transactions_sync_projections_update
after update on public.transactions
referencing old table as old_transaction_rows new table as new_transaction_rows
for each statement execute function public.sync_transactions_from_statement();
create trigger transactions_sync_projections_delete
after delete on public.transactions
referencing old table as old_transaction_rows
for each statement execute function public.sync_transactions_from_statement();

create or replace function public.sync_group_ledgers_from_statement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    payload jsonb;
begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      into payload
      from public.transactions t
     where exists (
         select 1
           from old_group_rows o
           join new_group_rows n on n.user_id = o.user_id and n.id = o.id
          where t.user_id = n.user_id
            and t.group_id = n.id
            and (
                n.type is distinct from o.type
                or n.title is distinct from o.title
                or n.source_wallet_id is distinct from o.source_wallet_id
                or n.destination_wallet_id is distinct from o.destination_wallet_id
                or n.credit_card_id is distinct from o.credit_card_id
            )
     );
    if jsonb_array_length(payload) > 0 then
        perform public.sync_finance_transactions_batch('[]'::jsonb, payload);
    end if;
    return null;
end;
$$;

drop trigger if exists transaction_groups_sync_ledgers on public.transaction_groups;
drop trigger if exists transaction_groups_sync_ledgers_batch on public.transaction_groups;
create trigger transaction_groups_sync_ledgers_batch
after update on public.transaction_groups
referencing old table as old_group_rows new table as new_group_rows
for each statement execute function public.sync_group_ledgers_from_statement();

-- Keep the original full loader available behind a small wrapper. During a
-- commit the legacy implementation of apply_finance_changes calls the wrapper
-- in compact mode, avoiding a full-account JSON aggregation.
do $$
begin
    if to_regprocedure('public.load_finance_snapshot_full()') is null then
        alter function public.load_finance_snapshot() rename to load_finance_snapshot_full;
    end if;
end;
$$;

create or replace function public.load_finance_snapshot()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
    if current_setting('prism.compact_finance_commit', true) = 'on' then
        return jsonb_build_object(
            'revision', coalesce((select revision from public.finance_sync_state where user_id = auth.uid()), 0),
            'server_time', now(),
            'data', null,
            'tombstones', '[]'::jsonb
        );
    end if;
    return public.load_finance_snapshot_full();
end;
$$;

do $$
begin
    if to_regprocedure('public.apply_finance_changes_rowwise(bigint,jsonb,text)') is null then
        alter function public.apply_finance_changes(bigint, jsonb, text) rename to apply_finance_changes_rowwise;
    end if;
end;
$$;

create or replace function public.apply_finance_changes(
    expected_revision bigint,
    changes jsonb,
    client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    commit_result jsonb;
    committed_revision bigint;
begin
    -- Clients prior to protocol 2 still receive the original response shape.
    -- This makes it safe to deploy the compatible frontend before this
    -- migration and keeps old tabs functional during a rolling release.
    if (case
           when coalesce(changes ->> 'protocol_version', '') ~ '^[0-9]+$'
               then (changes ->> 'protocol_version')::integer
           else 0
       end) < 2
       and coalesce(client_id, '') not like '%:safe-snapshot-adapter' then
        return public.apply_finance_changes_rowwise(expected_revision, changes, client_id);
    end if;

    perform set_config('prism.compact_finance_commit', 'on', true);
    commit_result := public.apply_finance_changes_rowwise(expected_revision, changes, client_id);
    perform set_config('prism.compact_finance_commit', 'off', true);

    committed_revision := (commit_result ->> 'revision')::bigint;
    return jsonb_build_object(
        'revision', committed_revision,
        'changes', public.load_finance_changes(expected_revision, 1)
    );
end;
$$;

revoke all on function public.recompute_wallet_balances_batch(jsonb) from public;
revoke all on function public.sync_finance_transactions_batch(jsonb, jsonb) from public;
revoke all on function public.sync_wallet_balances_from_statement() from public;
revoke all on function public.sync_transactions_from_statement() from public;
revoke all on function public.sync_group_ledgers_from_statement() from public;
revoke all on function public.load_finance_snapshot_full() from public;
revoke all on function public.apply_finance_changes_rowwise(bigint, jsonb, text) from public;
revoke all on function public.load_finance_snapshot() from public;
revoke all on function public.apply_finance_changes(bigint, jsonb, text) from public;
grant execute on function public.load_finance_snapshot() to authenticated;
grant execute on function public.apply_finance_changes(bigint, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
