-- Relational integrity and server-owned financial projections.

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'wallets', 'credit_cards', 'beneficiaries', 'categories', 'tags',
        'wish_items', 'transaction_groups', 'credit_card_invoices',
        'transactions', 'ledger_entries', 'transaction_tags'
    ] loop
        execute format('alter table public.%I add column if not exists version bigint not null default 0', table_name);
        execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);
    end loop;
end;
$$;

alter table public.finance_preferences
    add column if not exists version bigint not null default 0;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'finance_preferences', 'wallets', 'credit_cards', 'beneficiaries',
        'categories', 'tags', 'wish_items', 'transaction_groups',
        'credit_card_invoices', 'transactions', 'ledger_entries', 'transaction_tags'
    ] loop
        execute format(
            'create index if not exists %I on public.%I(user_id, version)',
            table_name || '_user_version_idx',
            table_name
        );
    end loop;
end;
$$;

create table if not exists public.finance_tombstones (
    user_id uuid not null references auth.users(id) on delete cascade,
    entity_type text not null check (entity_type in (
        'wallet', 'credit_card', 'beneficiary', 'category', 'tag', 'wish_item',
        'transaction_group', 'credit_card_invoice', 'transaction',
        'ledger_entry', 'transaction_tag'
    )),
    entity_id text not null,
    related_id text not null default '',
    version bigint not null check (version > 0),
    deleted_at timestamptz not null default now(),
    deleted_by text,
    primary key (user_id, entity_type, entity_id, related_id)
);

alter table public.finance_tombstones enable row level security;
drop policy if exists "finance-tombstones-own-read" on public.finance_tombstones;
create policy "finance-tombstones-own-read" on public.finance_tombstones
    for select to authenticated using (user_id = auth.uid());

create index if not exists finance_tombstones_user_version_idx
    on public.finance_tombstones(user_id, version, entity_type);

-- Normalize legacy values before validating constraints.
update public.wallets set currency = 'BRL' where currency !~ '^[A-Z]{3}$';
update public.credit_cards set credit_limit = greatest(0, credit_limit);
update public.wish_items set value = greatest(0, value);
update public.transaction_groups set total_amount = abs(total_amount);
update public.transaction_groups
   set installment_count = null
 where installment_count is not null and installment_count <= 0;
update public.credit_card_invoices
   set total_amount = greatest(0, total_amount),
       paid_amount = least(greatest(0, total_amount), greatest(0, paid_amount));
update public.transactions
   set paid_at = case
       when status = 'paid' then coalesce(paid_at, created_at)
       else null
   end;
update public.transactions
   set installment_number = null
 where installment_number is not null and installment_number <= 0;

delete from public.ledger_entries
 where transaction_id is null and invoice_id is null;

update public.beneficiaries b
   set family_id = null, source = 'personal'
 where b.family_id is not null
   and not exists (select 1 from public.families f where f.id = b.family_id);

update public.beneficiaries
   set family_id = null
 where source = 'personal' and family_id is not null;

update public.beneficiaries
   set source = 'personal'
 where source = 'family_shared' and family_id is null;

update public.finance_preferences p
   set favorite_wallet_id = null
 where favorite_wallet_id is not null
   and not exists (
       select 1 from public.wallets w
        where w.user_id = p.user_id and w.id = p.favorite_wallet_id
   );
update public.finance_preferences p
   set favorite_credit_card_id = null
 where favorite_credit_card_id is not null
   and not exists (
       select 1 from public.credit_cards c
        where c.user_id = p.user_id and c.id = p.favorite_credit_card_id
   );

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'wallets_currency_format_check') then
        alter table public.wallets add constraint wallets_currency_format_check check (currency ~ '^[A-Z]{3}$');
    end if;
    if not exists (select 1 from pg_constraint where conname = 'credit_cards_limit_nonnegative_check') then
        alter table public.credit_cards add constraint credit_cards_limit_nonnegative_check check (credit_limit >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'wish_items_value_nonnegative_check') then
        alter table public.wish_items add constraint wish_items_value_nonnegative_check check (value >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transaction_groups_total_nonnegative_check') then
        alter table public.transaction_groups add constraint transaction_groups_total_nonnegative_check check (total_amount >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transaction_groups_installment_count_check') then
        alter table public.transaction_groups add constraint transaction_groups_installment_count_check
            check (installment_count is null or installment_count > 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transaction_groups_transfer_wallets_check') then
        alter table public.transaction_groups add constraint transaction_groups_transfer_wallets_check
            check (
                type <> 'transfer'
                or (source_wallet_id is not null and destination_wallet_id is not null and source_wallet_id <> destination_wallet_id and credit_card_id is null)
            ) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'credit_card_invoices_amounts_check') then
        alter table public.credit_card_invoices add constraint credit_card_invoices_amounts_check
            check (total_amount >= 0 and paid_amount >= 0 and paid_amount <= total_amount);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'credit_card_invoices_paid_state_check') then
        alter table public.credit_card_invoices add constraint credit_card_invoices_paid_state_check
            check (
                (status = 'open' and paid_at is null)
                or (status = 'paid' and total_amount > 0 and paid_amount = total_amount and paid_at is not null)
            ) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transactions_paid_state_check') then
        alter table public.transactions add constraint transactions_paid_state_check
            check ((status = 'paid' and paid_at is not null) or (status <> 'paid' and paid_at is null));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transactions_installment_number_check') then
        alter table public.transactions add constraint transactions_installment_number_check
            check (installment_number is null or installment_number > 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'ledger_entries_source_check') then
        alter table public.ledger_entries add constraint ledger_entries_source_check
            check (transaction_id is not null or invoice_id is not null);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'beneficiaries_family_source_check') then
        alter table public.beneficiaries add constraint beneficiaries_family_source_check
            check ((source = 'personal' and family_id is null) or (source = 'family_shared' and family_id is not null));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'beneficiaries_family_fk') then
        alter table public.beneficiaries add constraint beneficiaries_family_fk
            foreign key (family_id) references public.families(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'finance_preferences_favorite_wallet_fk') then
        alter table public.finance_preferences add constraint finance_preferences_favorite_wallet_fk
            foreign key (user_id, favorite_wallet_id) references public.wallets(user_id, id)
            on delete set null (favorite_wallet_id) deferrable initially deferred;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'finance_preferences_favorite_credit_card_fk') then
        alter table public.finance_preferences add constraint finance_preferences_favorite_credit_card_fk
            foreign key (user_id, favorite_credit_card_id) references public.credit_cards(user_id, id)
            on delete set null (favorite_credit_card_id) deferrable initially deferred;
    end if;
end;
$$;

create unique index if not exists credit_card_invoices_user_card_cycle_uidx
    on public.credit_card_invoices(user_id, credit_card_id, cycle_key);
create unique index if not exists transactions_user_group_installment_uidx
    on public.transactions(user_id, group_id, installment_number)
    where installment_number is not null;
create unique index if not exists ledger_entries_user_transaction_wallet_uidx
    on public.ledger_entries(user_id, transaction_id, wallet_id)
    where transaction_id is not null;
create unique index if not exists beneficiaries_user_self_profile_uidx
    on public.beneficiaries(user_id)
    where is_self_profile;

create index if not exists credit_cards_user_bank_wallet_idx on public.credit_cards(user_id, bank_wallet_id) where bank_wallet_id is not null;
create index if not exists beneficiaries_family_idx on public.beneficiaries(family_id) where family_id is not null;
create index if not exists categories_user_parent_idx on public.categories(user_id, parent_id) where parent_id is not null;
create index if not exists wish_items_user_category_idx on public.wish_items(user_id, category_id);
create index if not exists transaction_groups_user_beneficiary_idx on public.transaction_groups(user_id, beneficiary_id) where beneficiary_id is not null;
create index if not exists transaction_groups_user_category_idx on public.transaction_groups(user_id, category_id) where category_id is not null;
create index if not exists transaction_groups_user_source_wallet_idx on public.transaction_groups(user_id, source_wallet_id) where source_wallet_id is not null;
create index if not exists transaction_groups_user_destination_wallet_idx on public.transaction_groups(user_id, destination_wallet_id) where destination_wallet_id is not null;
create index if not exists transaction_groups_user_credit_card_idx on public.transaction_groups(user_id, credit_card_id) where credit_card_id is not null;
create index if not exists transactions_user_group_idx on public.transactions(user_id, group_id);
create index if not exists transactions_user_invoice_idx on public.transactions(user_id, invoice_id) where invoice_id is not null;
create index if not exists transactions_user_category_idx on public.transactions(user_id, category_id) where category_id is not null;
create index if not exists transactions_user_beneficiary_idx on public.transactions(user_id, beneficiary_id) where beneficiary_id is not null;
create index if not exists transactions_user_source_wallet_idx on public.transactions(user_id, source_wallet_id) where source_wallet_id is not null;
create index if not exists transactions_user_destination_wallet_idx on public.transactions(user_id, destination_wallet_id) where destination_wallet_id is not null;
create index if not exists transactions_user_credit_card_idx on public.transactions(user_id, credit_card_id) where credit_card_id is not null;
create index if not exists ledger_entries_user_wallet_date_idx on public.ledger_entries(user_id, wallet_id, created_at, id);
create index if not exists ledger_entries_user_transaction_idx on public.ledger_entries(user_id, transaction_id) where transaction_id is not null;
create index if not exists ledger_entries_user_invoice_idx on public.ledger_entries(user_id, invoice_id) where invoice_id is not null;
create index if not exists transaction_tags_user_tag_idx on public.transaction_tags(user_id, tag_id);

create or replace function public.validate_family_beneficiary_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if new.source = 'family_shared' and not exists (
        select 1
          from public.family_members fm
         where fm.family_id = new.family_id
           and fm.user_id = new.user_id
           and fm.status = 'active'
    ) then
        raise exception 'BENEFICIARY_FAMILY_MEMBERSHIP_REQUIRED' using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists beneficiaries_validate_family_membership on public.beneficiaries;
create trigger beneficiaries_validate_family_membership
before insert or update of family_id, source, user_id on public.beneficiaries
for each row execute function public.validate_family_beneficiary_membership();

alter table public.ledger_entries drop constraint if exists ledger_entries_transaction_id_fkey;
alter table public.ledger_entries add constraint ledger_entries_transaction_id_fkey
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade;
alter table public.ledger_entries drop constraint if exists ledger_entries_invoice_id_fkey;
alter table public.ledger_entries add constraint ledger_entries_invoice_id_fkey
    foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id) on delete cascade;

create or replace function public.recompute_wallet_balance(target_user_id uuid, target_wallet_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    with running_balances as (
        select le.id,
               w.initial_balance + sum(le.amount) over (
                   order by le.created_at, le.id
                   rows between unbounded preceding and current row
               ) as calculated_balance
          from public.ledger_entries le
          join public.wallets w
            on w.user_id = le.user_id and w.id = le.wallet_id
         where le.user_id = target_user_id and le.wallet_id = target_wallet_id
    )
    update public.ledger_entries le
       set balance_after = rb.calculated_balance,
           version = greatest(le.version, coalesce((
               select s.revision from public.finance_sync_state s where s.user_id = target_user_id
           ), 0)),
           updated_at = now()
      from running_balances rb
     where le.user_id = target_user_id and le.id = rb.id
       and le.balance_after is distinct from rb.calculated_balance;

    update public.wallets w
       set balance = w.initial_balance + coalesce((
               select sum(le.amount)
                 from public.ledger_entries le
                where le.user_id = target_user_id and le.wallet_id = target_wallet_id
           ), 0),
           updated_at = now(),
           version = greatest(w.version, coalesce((
               select s.revision from public.finance_sync_state s where s.user_id = target_user_id
           ), 0))
     where w.user_id = target_user_id and w.id = target_wallet_id;
end;
$$;

create or replace function public.sync_wallet_balance_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op <> 'INSERT' then
        perform public.recompute_wallet_balance(old.user_id, old.wallet_id);
    end if;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or old.user_id is distinct from new.user_id or old.wallet_id is distinct from new.wallet_id) then
        perform public.recompute_wallet_balance(new.user_id, new.wallet_id);
    elsif tg_op = 'UPDATE' then
        perform public.recompute_wallet_balance(new.user_id, new.wallet_id);
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists ledger_entries_sync_wallet_balance on public.ledger_entries;
create trigger ledger_entries_sync_wallet_balance
after insert or delete or update of wallet_id, amount, created_at on public.ledger_entries
for each row execute function public.sync_wallet_balance_from_ledger();

create or replace function public.sync_wallet_initial_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform public.recompute_wallet_balance(new.user_id, new.id);
    return new;
end;
$$;

drop trigger if exists wallets_sync_initial_balance on public.wallets;
create trigger wallets_sync_initial_balance
after insert or update of initial_balance on public.wallets
for each row execute function public.sync_wallet_initial_balance();

create or replace function public.recompute_credit_card_invoice(target_user_id uuid, target_invoice_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    calculated_total numeric(14, 2);
begin
    select coalesce(sum(abs(amount)) filter (where status not in ('cancelled', 'skipped')), 0)
      into calculated_total
      from public.transactions
     where user_id = target_user_id and invoice_id = target_invoice_id;

    update public.credit_card_invoices
       set total_amount = calculated_total,
           paid_amount = least(paid_amount, calculated_total),
           status = case when calculated_total > 0 and paid_amount >= calculated_total then 'paid' else 'open' end,
           paid_at = case when calculated_total > 0 and paid_amount >= calculated_total then coalesce(paid_at, now()) else null end,
           updated_at = now(),
           version = greatest(credit_card_invoices.version, coalesce((
               select s.revision from public.finance_sync_state s where s.user_id = target_user_id
           ), 0))
     where user_id = target_user_id and id = target_invoice_id;
end;
$$;

create or replace function public.sync_invoice_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op <> 'INSERT' and old.invoice_id is not null then
        perform public.recompute_credit_card_invoice(old.user_id, old.invoice_id);
    end if;
    if tg_op <> 'DELETE' and new.invoice_id is not null
       and (tg_op = 'INSERT' or old.user_id is distinct from new.user_id or old.invoice_id is distinct from new.invoice_id) then
        perform public.recompute_credit_card_invoice(new.user_id, new.invoice_id);
    elsif tg_op = 'UPDATE' and new.invoice_id is not null then
        perform public.recompute_credit_card_invoice(new.user_id, new.invoice_id);
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists transactions_sync_invoice on public.transactions;
create trigger transactions_sync_invoice
after insert or delete or update of invoice_id, amount, status on public.transactions
for each row execute function public.sync_invoice_from_transaction();

create or replace function public.recompute_transaction_group_total(target_user_id uuid, target_group_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
    update public.transaction_groups g
       set total_amount = coalesce((
               select sum(abs(t.amount))
                 from public.transactions t
                where t.user_id = target_user_id and t.group_id = target_group_id
           ), 0),
           updated_at = now(),
           version = greatest(g.version, coalesce((
               select s.revision from public.finance_sync_state s where s.user_id = target_user_id
           ), 0))
     where g.user_id = target_user_id
       and g.id = target_group_id
       and g.transaction_mode in ('single', 'installment');
$$;

create or replace function public.sync_group_total_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op <> 'INSERT' then
        perform public.recompute_transaction_group_total(old.user_id, old.group_id);
    end if;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or old.user_id is distinct from new.user_id or old.group_id is distinct from new.group_id) then
        perform public.recompute_transaction_group_total(new.user_id, new.group_id);
    elsif tg_op = 'UPDATE' then
        perform public.recompute_transaction_group_total(new.user_id, new.group_id);
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists transactions_sync_group_total on public.transactions;
create trigger transactions_sync_group_total
after insert or delete or update of group_id, amount on public.transactions
for each row execute function public.sync_group_total_from_transaction();

create or replace function public.validate_transaction_invoice_card()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    invoice_card_id text;
    effective_card_id text;
begin
    if new.invoice_id is null then
        return new;
    end if;

    select credit_card_id into invoice_card_id
      from public.credit_card_invoices
     where user_id = new.user_id and id = new.invoice_id;
    select coalesce(new.credit_card_id, g.credit_card_id) into effective_card_id
      from public.transaction_groups g
     where g.user_id = new.user_id and g.id = new.group_id;

    if invoice_card_id is null or effective_card_id is distinct from invoice_card_id then
        raise exception 'TRANSACTION_INVOICE_CARD_MISMATCH' using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists transactions_validate_invoice_card on public.transactions;
create trigger transactions_validate_invoice_card
before insert or update of invoice_id, credit_card_id, group_id on public.transactions
for each row execute function public.validate_transaction_invoice_card();

-- Reconcile projections once after installing the triggers.
do $$
declare
    target record;
begin
    for target in select user_id, id from public.wallets loop
        perform public.recompute_wallet_balance(target.user_id, target.id);
    end loop;
    for target in select user_id, id from public.credit_card_invoices loop
        perform public.recompute_credit_card_invoice(target.user_id, target.id);
    end loop;
    for target in select user_id, id from public.transaction_groups loop
        perform public.recompute_transaction_group_total(target.user_id, target.id);
    end loop;
end;
$$;

revoke all on function public.validate_family_beneficiary_membership() from public;
revoke all on function public.recompute_wallet_balance(uuid, text) from public;
revoke all on function public.sync_wallet_balance_from_ledger() from public;
revoke all on function public.sync_wallet_initial_balance() from public;
revoke all on function public.recompute_credit_card_invoice(uuid, text) from public;
revoke all on function public.sync_invoice_from_transaction() from public;
revoke all on function public.recompute_transaction_group_total(uuid, text) from public;
revoke all on function public.sync_group_total_from_transaction() from public;
revoke all on function public.validate_transaction_invoice_card() from public;
