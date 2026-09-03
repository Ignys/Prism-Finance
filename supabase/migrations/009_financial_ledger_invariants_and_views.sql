-- Paid transactions own their ledger projection. Clients may send the legacy
-- rows during rollout, but constraints ensure they match the server projection.

create or replace function public.validate_ledger_entry_against_transaction()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    tx record;
    expected_source_wallet text;
    expected_destination_wallet text;
    expected_card text;
    is_valid boolean := false;
begin
    if new.transaction_id is null or new.invoice_id is not null then
        raise exception 'LEDGER_TRANSACTION_REQUIRED' using errcode = '23514';
    end if;

    select t.amount,
           t.status,
           g.type,
           coalesce(t.source_wallet_id, g.source_wallet_id) as source_wallet_id,
           coalesce(t.destination_wallet_id, g.destination_wallet_id) as destination_wallet_id,
           coalesce(t.credit_card_id, g.credit_card_id) as credit_card_id
      into tx
      from public.transactions t
      join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
     where t.user_id = new.user_id and t.id = new.transaction_id;

    if not found or tx.status <> 'paid' then
        raise exception 'LEDGER_PAID_TRANSACTION_REQUIRED' using errcode = '23514';
    end if;

    expected_source_wallet := tx.source_wallet_id;
    expected_destination_wallet := tx.destination_wallet_id;
    expected_card := tx.credit_card_id;

    if tx.type = 'income' then
        is_valid := new.wallet_id = expected_source_wallet and new.amount = abs(tx.amount);
    elsif tx.type = 'expense' and expected_card is null then
        is_valid := new.wallet_id = expected_source_wallet and new.amount = -abs(tx.amount);
    elsif tx.type = 'transfer' then
        is_valid :=
            (new.wallet_id = expected_source_wallet and new.amount = -abs(tx.amount))
            or (new.wallet_id = expected_destination_wallet and new.amount = abs(tx.amount));
    end if;

    if is_valid is distinct from true then
        raise exception 'LEDGER_ENTRY_DOES_NOT_MATCH_TRANSACTION' using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists ledger_entries_validate_transaction on public.ledger_entries;
create trigger ledger_entries_validate_transaction
before insert or update of user_id, transaction_id, wallet_id, amount on public.ledger_entries
for each row execute function public.validate_ledger_entry_against_transaction();

create or replace function public.rebuild_transaction_ledger(target_user_id uuid, target_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    tx record;
    source_wallet text;
    destination_wallet text;
    card_id text;
    entry_time timestamptz;
    entry_version bigint;
begin
    delete from public.ledger_entries
     where user_id = target_user_id and transaction_id = target_transaction_id;

    select t.id,
           t.amount,
           t.status,
           t.paid_at,
           t.created_at,
           coalesce(t.title, g.title) as title,
           g.type,
           coalesce(t.source_wallet_id, g.source_wallet_id) as source_wallet_id,
           coalesce(t.destination_wallet_id, g.destination_wallet_id) as destination_wallet_id,
           coalesce(t.credit_card_id, g.credit_card_id) as credit_card_id
      into tx
      from public.transactions t
      join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
     where t.user_id = target_user_id and t.id = target_transaction_id;

    if not found or tx.status <> 'paid' then
        return;
    end if;

    source_wallet := tx.source_wallet_id;
    destination_wallet := tx.destination_wallet_id;
    card_id := tx.credit_card_id;
    entry_time := coalesce(tx.paid_at, tx.created_at, now());
    entry_version := coalesce((select revision from public.finance_sync_state where user_id = target_user_id), 0);

    if tx.type = 'income' and source_wallet is not null then
        insert into public.ledger_entries(user_id, id, wallet_id, transaction_id, invoice_id, amount, balance_after, description, created_at, updated_at, version)
        values (target_user_id, 'le-' || tx.id, source_wallet, tx.id, null, abs(tx.amount), 0, 'Receita: ' || tx.title, entry_time, now(), entry_version);
    elsif tx.type = 'expense' and card_id is null and source_wallet is not null then
        insert into public.ledger_entries(user_id, id, wallet_id, transaction_id, invoice_id, amount, balance_after, description, created_at, updated_at, version)
        values (target_user_id, 'le-' || tx.id, source_wallet, tx.id, null, -abs(tx.amount), 0, 'Despesa: ' || tx.title, entry_time, now(), entry_version);
    elsif tx.type = 'transfer' and source_wallet is not null then
        insert into public.ledger_entries(user_id, id, wallet_id, transaction_id, invoice_id, amount, balance_after, description, created_at, updated_at, version)
        values (target_user_id, 'le-' || tx.id || '-source', source_wallet, tx.id, null, -abs(tx.amount), 0, 'Transferencia enviada: ' || tx.title, entry_time, now(), entry_version);

        if destination_wallet is not null and destination_wallet <> source_wallet then
            insert into public.ledger_entries(user_id, id, wallet_id, transaction_id, invoice_id, amount, balance_after, description, created_at, updated_at, version)
            values (target_user_id, 'le-' || tx.id || '-dest', destination_wallet, tx.id, null, abs(tx.amount), 0, 'Transferencia recebida: ' || tx.title, entry_time, now(), entry_version);
        end if;
    end if;
end;
$$;

create or replace function public.sync_transaction_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'DELETE' then
        return old;
    end if;
    perform public.rebuild_transaction_ledger(new.user_id, new.id);
    return new;
end;
$$;

drop trigger if exists transactions_sync_ledger on public.transactions;
create trigger transactions_sync_ledger
after insert or update of amount, status, paid_at, source_wallet_id, destination_wallet_id, credit_card_id, title, group_id on public.transactions
for each row execute function public.sync_transaction_ledger();

create or replace function public.sync_group_ledgers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    transaction_id text;
begin
    for transaction_id in
        select t.id from public.transactions t
         where t.user_id = new.user_id and t.group_id = new.id and t.status = 'paid'
    loop
        perform public.rebuild_transaction_ledger(new.user_id, transaction_id);
    end loop;
    return new;
end;
$$;

drop trigger if exists transaction_groups_sync_ledgers on public.transaction_groups;
create trigger transaction_groups_sync_ledgers
after update of type, title, source_wallet_id, destination_wallet_id, credit_card_id on public.transaction_groups
for each row execute function public.sync_group_ledgers();

create or replace function public.assert_transaction_group_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_mode text;
    current_total numeric(14, 2);
    calculated_total numeric(14, 2);
begin
    select g.transaction_mode, g.total_amount
      into current_mode, current_total
      from public.transaction_groups g
     where g.user_id = new.user_id and g.id = new.id;
    if not found or current_mode = 'recurring' then
        return new;
    end if;

    select coalesce(sum(abs(t.amount)), 0)
      into calculated_total
      from public.transactions t
     where t.user_id = new.user_id and t.group_id = new.id;
    if current_total is distinct from calculated_total then
        raise exception 'TRANSACTION_GROUP_TOTAL_MISMATCH' using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists transaction_groups_validate_total on public.transaction_groups;
create constraint trigger transaction_groups_validate_total
after insert or update on public.transaction_groups
deferrable initially deferred
for each row execute function public.assert_transaction_group_total();

-- Replace legacy ledger shapes with the canonical projection.
do $$
declare
    target record;
begin
    for target in select user_id, id from public.transactions loop
        perform public.rebuild_transaction_ledger(target.user_id, target.id);
    end loop;
end;
$$;

create or replace view public.effective_transactions
with (security_invoker = true)
as
select t.*,
       g.type as group_type,
       g.transaction_mode,
       coalesce(t.title, g.title) as effective_title,
       coalesce(t.category_id, g.category_id) as effective_category_id,
       coalesce(t.beneficiary_id, g.beneficiary_id) as effective_beneficiary_id,
       coalesce(t.source_wallet_id, g.source_wallet_id) as effective_source_wallet_id,
       coalesce(t.destination_wallet_id, g.destination_wallet_id) as effective_destination_wallet_id,
       coalesce(t.credit_card_id, g.credit_card_id) as effective_credit_card_id
  from public.transactions t
  join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id;

grant select on public.effective_transactions to authenticated;

revoke all on function public.validate_ledger_entry_against_transaction() from public;
revoke all on function public.rebuild_transaction_ledger(uuid, text) from public;
revoke all on function public.sync_transaction_ledger() from public;
revoke all on function public.sync_group_ledgers() from public;
revoke all on function public.assert_transaction_group_total() from public;
