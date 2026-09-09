create or replace function public.invoice_cycle_for_date(occurrence_date date, closing_day integer, due_day integer)
returns table(cycle_key text, closing_date date, due_date date)
language sql immutable set search_path = public, pg_temp as $$
    with due_month as (
        select (date_trunc('month', occurrence_date) + make_interval(months =>
            case when closing_day <= due_day then case when extract(day from occurrence_date) > closing_day then 1 else 0 end
                 else case when extract(day from occurrence_date) > closing_day then 2 else 1 end end))::date as month
    ), anchors as (
        select month, (month - make_interval(months => case when closing_day > due_day then 1 else 0 end))::date as closing_month from due_month
    )
    select to_char(month, 'YYYY-MM'),
           closing_month + (least(closing_day, extract(day from closing_month + interval '1 month - 1 day')::integer) - 1),
           month + (least(due_day, extract(day from month + interval '1 month - 1 day')::integer) - 1)
      from anchors;
$$;

create or replace function public.assign_transaction_invoice()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare card public.credit_cards; previous public.transactions; cycle record; assigned_id text;
begin
    select c.* into card from public.transaction_groups g join public.credit_cards c
      on c.user_id = g.user_id and c.id = coalesce(new.credit_card_id, g.credit_card_id)
     where g.user_id = new.user_id and g.id = new.group_id;
    if not found then new.invoice_id := null; return new; end if;
    if tg_op = 'UPDATE' then previous := old;
    else select * into previous from public.transactions where user_id = new.user_id and id = new.id;
    end if;
    if new.invoice_id is not null and not (new.scheduled_date is distinct from previous.scheduled_date and new.invoice_id = previous.invoice_id) then return new; end if;
    select * into cycle from public.invoice_cycle_for_date(new.scheduled_date, card.closing_day, card.due_day);
    select i.id into assigned_id from public.credit_card_invoices i where i.user_id = new.user_id and i.credit_card_id = card.id and i.cycle_key = cycle.cycle_key;
    if assigned_id is null then
        assigned_id := 'invoice-' || card.id || '-' || cycle.cycle_key;
        insert into public.credit_card_invoices(user_id, id, credit_card_id, cycle_key, closing_date, due_date, total_amount, paid_amount, status, created_at, updated_at)
        values(new.user_id, assigned_id, card.id, cycle.cycle_key, cycle.closing_date, cycle.due_date, 0, 0, 'open', now(), now());
    end if;
    new.invoice_id := assigned_id;
    return new;
end;
$$;
create trigger transactions_assign_invoice before insert or update on public.transactions for each row execute function public.assign_transaction_invoice();
revoke all on function public.assign_transaction_invoice() from public;
revoke all on function public.invoice_cycle_for_date(date, integer, integer) from public;
grant execute on function public.invoice_cycle_for_date(date, integer, integer) to authenticated;
