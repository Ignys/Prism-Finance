-- Invoice payments are linked relationally instead of being trusted as a
-- duplicated paid_amount sent by the client. Legacy notes are backfilled and a
-- trigger keeps old frontend versions compatible during rollout.

alter table public.transactions
    add column if not exists payment_for_invoice_id text;

-- Transaction direction belongs to transaction_groups.type; amounts are
-- canonical magnitudes. This matches the existing frontend normalization.
update public.transactions set amount = abs(amount) where amount < 0;

with legacy_payment_candidates as (
    select t.user_id,
           t.id,
           i.id as invoice_id,
           i.total_amount,
           t.status,
           sum(case when t.status = 'paid' then abs(t.amount) else 0 end) over (
               partition by t.user_id, i.id
               order by coalesce(t.paid_at, t.created_at), t.id
               rows between unbounded preceding and current row
           ) as running_paid_amount
      from public.transactions t
      join public.credit_card_invoices i
        on i.user_id = t.user_id
       and i.id = split_part(t.notes, '|', 2)
       and i.credit_card_id = split_part(t.notes, '|', 3)
     where t.notes like '[prism-invoice-payment]|%|%'
       and split_part(t.notes, '|', 2) <> ''
)
update public.transactions t
   set payment_for_invoice_id = candidate.invoice_id
  from legacy_payment_candidates candidate
 where t.user_id = candidate.user_id
   and t.id = candidate.id
   and (candidate.status <> 'paid' or candidate.running_paid_amount <= candidate.total_amount);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'transactions_payment_for_invoice_fk') then
        alter table public.transactions add constraint transactions_payment_for_invoice_fk
            foreign key (user_id, payment_for_invoice_id)
            references public.credit_card_invoices(user_id, id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transactions_purchase_or_payment_invoice_check') then
        alter table public.transactions add constraint transactions_purchase_or_payment_invoice_check
            check (invoice_id is null or payment_for_invoice_id is null);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'transactions_amount_positive_check') then
        alter table public.transactions add constraint transactions_amount_positive_check
            check (amount > 0) not valid;
    end if;
end;
$$;

create index if not exists transactions_user_payment_invoice_idx
    on public.transactions(user_id, payment_for_invoice_id)
    where payment_for_invoice_id is not null;

create or replace function public.resolve_invoice_payment_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    target_invoice_id text;
    target_card_id text;
    invoice_total numeric(14, 2);
begin
    if new.notes like '[prism-invoice-payment]|%|%' then
        target_invoice_id := split_part(new.notes, '|', 2);
        target_card_id := split_part(new.notes, '|', 3);
        select i.total_amount into invoice_total
          from public.credit_card_invoices i
         where i.user_id = new.user_id
           and i.id = target_invoice_id
           and i.credit_card_id = target_card_id;
        if target_invoice_id = '' or target_card_id = '' or invoice_total is null then
            raise exception 'INVOICE_PAYMENT_LINK_INVALID' using errcode = '23514';
        end if;
    elsif new.payment_for_invoice_id is not null then
        target_invoice_id := new.payment_for_invoice_id;
        select i.total_amount into invoice_total
          from public.credit_card_invoices i
         where i.user_id = new.user_id
           and i.id = target_invoice_id;
        if not found then
            raise exception 'INVOICE_PAYMENT_LINK_INVALID' using errcode = '23514';
        end if;
    else
        new.payment_for_invoice_id := null;
        return new;
    end if;

    new.payment_for_invoice_id := target_invoice_id;
    return new;
end;
$$;

drop trigger if exists transactions_resolve_invoice_payment on public.transactions;
create trigger transactions_resolve_invoice_payment
before insert or update of notes, payment_for_invoice_id, status, amount on public.transactions
for each row execute function public.resolve_invoice_payment_link();

create or replace function public.assert_invoice_not_overpaid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    target_user_id uuid;
    target_invoice_id text;
    invoice_total numeric(14, 2);
    payment_total numeric(14, 2);
begin
    if tg_op = 'DELETE' then
        target_user_id := old.user_id;
        target_invoice_id := old.payment_for_invoice_id;
    else
        target_user_id := new.user_id;
        target_invoice_id := new.payment_for_invoice_id;
    end if;
    if target_invoice_id is null then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;

    select total_amount into invoice_total
      from public.credit_card_invoices
     where user_id = target_user_id and id = target_invoice_id;
    select coalesce(sum(abs(amount)) filter (where status = 'paid'), 0)
      into payment_total
      from public.transactions
     where user_id = target_user_id and payment_for_invoice_id = target_invoice_id;

    if invoice_total is not null and payment_total > invoice_total then
        raise exception 'INVOICE_OVERPAYMENT' using errcode = '23514';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists transactions_prevent_invoice_overpayment on public.transactions;
create constraint trigger transactions_prevent_invoice_overpayment
after insert or update or delete on public.transactions
deferrable initially deferred
for each row execute function public.assert_invoice_not_overpaid();

create or replace function public.assert_invoice_payment_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    invoice_total numeric(14, 2);
    payment_total numeric(14, 2);
begin
    select i.total_amount into invoice_total
      from public.credit_card_invoices i
     where i.user_id = new.user_id and i.id = new.id;
    if invoice_total is null then
        return new;
    end if;

    select coalesce(sum(abs(t.amount)) filter (where t.status = 'paid'), 0)
      into payment_total
      from public.transactions t
     where t.user_id = new.user_id and t.payment_for_invoice_id = new.id;
    if payment_total > invoice_total then
        raise exception 'INVOICE_OVERPAYMENT' using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists credit_card_invoices_prevent_overpayment on public.credit_card_invoices;
create constraint trigger credit_card_invoices_prevent_overpayment
after insert or update on public.credit_card_invoices
deferrable initially deferred
for each row execute function public.assert_invoice_payment_total();

create or replace function public.recompute_credit_card_invoice(target_user_id uuid, target_invoice_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    calculated_total numeric(14, 2);
    calculated_paid numeric(14, 2);
begin
    select coalesce(sum(abs(amount)) filter (where status not in ('cancelled', 'skipped')), 0)
      into calculated_total
      from public.transactions
     where user_id = target_user_id and invoice_id = target_invoice_id;

    select coalesce(sum(abs(amount)) filter (where status = 'paid'), 0)
      into calculated_paid
      from public.transactions
     where user_id = target_user_id and payment_for_invoice_id = target_invoice_id;

    calculated_paid := least(calculated_paid, calculated_total);
    update public.credit_card_invoices
       set total_amount = calculated_total,
           paid_amount = calculated_paid,
           status = case when calculated_total > 0 and calculated_paid = calculated_total then 'paid' else 'open' end,
           paid_at = case when calculated_total > 0 and calculated_paid = calculated_total then coalesce(paid_at, now()) else null end,
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
    if tg_op <> 'INSERT' then
        if old.invoice_id is not null then
            perform public.recompute_credit_card_invoice(old.user_id, old.invoice_id);
        end if;
        if old.payment_for_invoice_id is not null and old.payment_for_invoice_id is distinct from old.invoice_id then
            perform public.recompute_credit_card_invoice(old.user_id, old.payment_for_invoice_id);
        end if;
    end if;

    if tg_op <> 'DELETE' then
        if new.invoice_id is not null then
            perform public.recompute_credit_card_invoice(new.user_id, new.invoice_id);
        end if;
        if new.payment_for_invoice_id is not null and new.payment_for_invoice_id is distinct from new.invoice_id then
            perform public.recompute_credit_card_invoice(new.user_id, new.payment_for_invoice_id);
        end if;
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists transactions_sync_invoice on public.transactions;
create trigger transactions_sync_invoice
after insert or delete or update of invoice_id, payment_for_invoice_id, amount, status on public.transactions
for each row execute function public.sync_invoice_from_transaction();

do $$
declare
    target record;
begin
    for target in select user_id, id from public.credit_card_invoices loop
        perform public.recompute_credit_card_invoice(target.user_id, target.id);
    end loop;
end;
$$;

revoke all on function public.resolve_invoice_payment_link() from public;
revoke all on function public.assert_invoice_not_overpaid() from public;
revoke all on function public.assert_invoice_payment_total() from public;
revoke all on function public.recompute_credit_card_invoice(uuid, text) from public;
revoke all on function public.sync_invoice_from_transaction() from public;
