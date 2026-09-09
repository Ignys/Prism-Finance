create or replace function public.guard_invoice_charge_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare old_row public.transactions; card_id text; group_mode text;
begin
    if tg_op <> 'INSERT' then old_row := old;
    else select * into old_row from public.transactions where user_id = new.user_id and id = new.id;
    end if;
    -- Intentional entity cascades remove the complete financial graph.
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
    if old_row.invoice_id is not null and exists (
        select 1 from public.transactions p where p.user_id = old_row.user_id and p.payment_for_invoice_id = old_row.invoice_id and p.status = 'paid'
    ) then
        if tg_op = 'DELETE' or new.amount is distinct from old_row.amount or new.scheduled_date is distinct from old_row.scheduled_date
           or new.invoice_id is distinct from old_row.invoice_id or new.status is distinct from old_row.status
           or coalesce(new.credit_card_id, (select g.credit_card_id from public.transaction_groups g where g.user_id=new.user_id and g.id=new.group_id))
              is distinct from coalesce(old_row.credit_card_id, (select g.credit_card_id from public.transaction_groups g where g.user_id=old_row.user_id and g.id=old_row.group_id))
           or new.commitment is distinct from old_row.commitment
        then raise exception 'PAID_INVOICE_CHARGE_IMMUTABLE' using errcode = '23514'; end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if new.invoice_id is not null and new.invoice_id is distinct from old_row.invoice_id and exists (
        select 1 from public.transactions p where p.user_id = new.user_id and p.payment_for_invoice_id = new.invoice_id and p.status = 'paid'
    ) then raise exception 'PAID_INVOICE_REQUIRES_PAYMENT_REVERSAL' using errcode = '23514'; end if;
    select coalesce(new.credit_card_id, g.credit_card_id), g.transaction_mode into card_id, group_mode
      from public.transaction_groups g where g.user_id = new.user_id and g.id = new.group_id;
    if card_id is not null and new.status = 'paid' and old_row.status is distinct from 'paid'
    then raise exception 'CARD_CHARGE_REQUIRES_INVOICE_PAYMENT' using errcode = '23514'; end if;
    if group_mode = 'recurring' and new.occurrence_number is null and old_row.id is null
    then raise exception 'RECURRENCE_OCCURRENCE_ID_REQUIRED' using errcode = '23514'; end if;
    if new.commitment = 'forecast' and new.status = 'paid'
    then raise exception 'PAID_TRANSACTION_CANNOT_BE_FORECAST' using errcode = '23514'; end if;
    if card_id is not null and group_mode = 'recurring' and new.commitment = 'posted'
       and old_row.commitment is distinct from 'posted' and new.scheduled_date > (now() at time zone 'America/Sao_Paulo')::date
    then raise exception 'FUTURE_RECURRENCE_REQUIRES_FORECAST' using errcode = '23514'; end if;
    -- Repeated/concurrent settlement of the same wallet occurrence retains the
    -- first canonical effective date. Date edits affect scheduled_date only.
    if old_row.status = 'paid' and new.status = 'paid' then new.paid_at := old_row.paid_at; end if;
    return new;
end;
$$;
create trigger transactions_guard_invoice_history before insert or update or delete on public.transactions for each row execute function public.guard_invoice_charge_history();

create or replace function public.guard_group_financial_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
    if (new.type, new.source_wallet_id, new.destination_wallet_id, new.credit_card_id)
       is distinct from (old.type, old.source_wallet_id, old.destination_wallet_id, old.credit_card_id)
       and exists (select 1 from public.transactions t where t.user_id = old.user_id and t.group_id = old.id and (t.status = 'paid' or
           (t.invoice_id is not null and exists (select 1 from public.transactions p where p.user_id = t.user_id and p.payment_for_invoice_id = t.invoice_id and p.status = 'paid'))))
    then raise exception 'GROUP_FINANCIAL_HISTORY_IMMUTABLE' using errcode = '23514'; end if;
    return new;
end;
$$;
create trigger transaction_groups_guard_history before update on public.transaction_groups for each row execute function public.guard_group_financial_history();
revoke all on function public.guard_invoice_charge_history() from public;
revoke all on function public.guard_group_financial_history() from public;
