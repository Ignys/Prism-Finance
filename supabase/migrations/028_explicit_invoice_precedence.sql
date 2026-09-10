-- An invoice_id submitted by the client is an explicit routing choice. The
-- purchase date is only a fallback when no invoice was provided.
create or replace function public.assign_transaction_invoice()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare card public.credit_cards; cycle record; assigned_id text;
begin
    select c.* into card from public.transaction_groups g join public.credit_cards c
      on c.user_id = g.user_id and c.id = public.resolve_transaction_routing(new.credit_card_id, g.credit_card_id, new.routing_override)
     where g.user_id = new.user_id and g.id = new.group_id;
    if not found then new.invoice_id := null; return new; end if;

    if new.invoice_id is not null then return new; end if;

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

revoke all on function public.assign_transaction_invoice() from public;
