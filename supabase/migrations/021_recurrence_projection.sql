-- Pure, owner-scoped counterpart to the frontend period selector. No invoice,
-- transaction or ledger rows are created by this query.
create or replace function public.project_recurring_occurrences(period_start date, period_end date)
returns table(group_id text, occurrence_number integer, scheduled_date date, amount numeric, credit_card_id text, invoice_id text, commitment text)
language sql stable security invoker set search_path = public, pg_temp as $$
    with rules as (
        select g.*, (g.recurrence_rule ->> 'anchorDate')::date as anchor,
               (g.recurrence_rule ->> 'interval')::integer as month_interval,
               coalesce((g.recurrence_rule ->> 'startNumber')::integer, 1) as first_number,
               coalesce(g.recurrence_rule ->> 'seriesId', g.id) as series_id
          from public.transaction_groups g where g.user_id = auth.uid() and g.transaction_mode = 'recurring'
    ), slots as (
        select r.*, n.ordinal,
               (r.anchor + make_interval(months => (n.ordinal - r.first_number) * r.month_interval))::date as occurrence_date
          from rules r cross join lateral generate_series(
              greatest(r.first_number, r.first_number + floor((12 * (extract(year from period_start) - extract(year from r.anchor)) + extract(month from period_start) - extract(month from r.anchor)) / r.month_interval)::integer),
              least(coalesce((r.recurrence_rule ->> 'stopNumber')::integer, 2147483647),
                  case when r.recurrence_rule #>> '{end,type}' = 'count' then (r.recurrence_rule #>> '{end,count}')::integer else 2147483647 end,
                  r.first_number + floor((12 * (extract(year from period_end) - extract(year from r.anchor)) + extract(month from period_end) - extract(month from r.anchor)) / r.month_interval)::integer)
          ) n(ordinal)
    )
    select s.id, s.ordinal, s.occurrence_date, (s.recurrence_rule ->> 'amount')::numeric,
           coalesce(s.recurrence_rule ->> 'creditCardId', s.credit_card_id),
           case when c.id is not null then coalesce((select i.id from public.credit_card_invoices i where i.user_id=s.user_id and i.credit_card_id=c.id and i.cycle_key=cycle.cycle_key), 'invoice-' || c.id || '-' || cycle.cycle_key) end,
           'forecast'::text
      from slots s left join public.credit_cards c on c.user_id = s.user_id and c.id = coalesce(s.recurrence_rule ->> 'creditCardId', s.credit_card_id)
      left join lateral public.invoice_cycle_for_date(s.occurrence_date, c.closing_day, c.due_day) cycle on c.id is not null
     where s.occurrence_date between period_start and period_end
       and (s.recurrence_end_date is null or s.occurrence_date <= s.recurrence_end_date)
       and (s.recurrence_rule #>> '{end,type}' <> 'until' or s.occurrence_date <= (s.recurrence_rule #>> '{end,date}')::date)
       and not coalesce(s.recurrence_rule -> 'excludedDates', '[]'::jsonb) ? s.occurrence_date::text
       and not exists (
           select 1 from public.transactions t join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
            where t.user_id = s.user_id and coalesce(g.recurrence_rule ->> 'seriesId', g.id) = s.series_id
              and (t.occurrence_number = s.ordinal or (t.occurrence_number is null and date_trunc('month', t.scheduled_date) = date_trunc('month', s.occurrence_date)))
       );
$$;

create or replace function public.guard_new_occurrence_range()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare rule jsonb; canonical_date date; end_date date; series_id text;
begin
    -- Existing occurrences are durable overrides, even after their segment ends.
    if new.occurrence_number is null or exists(select 1 from public.transactions where user_id = new.user_id and id = new.id) then return new; end if;
    select recurrence_rule, recurrence_end_date into rule, end_date from public.transaction_groups where user_id = new.user_id and id = new.group_id;
    if new.occurrence_number > coalesce((rule ->> 'stopNumber')::integer, 2147483647) then
        -- An individual routing override uses a non-projecting group revision.
        -- Its ordinal must still be valid in the series' active rule at commit.
        series_id := coalesce(rule ->> 'seriesId', new.group_id);
        select g.recurrence_rule, g.recurrence_end_date into rule, end_date
          from public.transaction_groups g where g.user_id = new.user_id and g.transaction_mode = 'recurring'
            and coalesce(g.recurrence_rule ->> 'seriesId', g.id) = series_id
            and new.occurrence_number between coalesce((g.recurrence_rule ->> 'startNumber')::integer, 1) and coalesce((g.recurrence_rule ->> 'stopNumber')::integer, 2147483647)
          order by g.id limit 1;
    end if;
    canonical_date := ( (rule ->> 'anchorDate')::date + make_interval(months => (new.occurrence_number - coalesce((rule ->> 'startNumber')::integer, 1)) * (rule ->> 'interval')::integer) )::date;
    if rule is null or new.occurrence_number < coalesce((rule ->> 'startNumber')::integer, 1)
       or new.occurrence_number > coalesce((rule ->> 'stopNumber')::integer, 2147483647)
       or (rule #>> '{end,type}' = 'count' and new.occurrence_number > (rule #>> '{end,count}')::integer)
       or (rule #>> '{end,type}' = 'until' and canonical_date > (rule #>> '{end,date}')::date)
       or (end_date is not null and canonical_date > end_date)
       or coalesce(rule -> 'excludedDates', '[]'::jsonb) ? canonical_date::text
    then raise exception 'RECURRENCE_OCCURRENCE_OUTSIDE_RULE' using errcode = '23514'; end if;
    return new;
end;
$$;
create trigger transactions_guard_occurrence_range before insert on public.transactions for each row execute function public.guard_new_occurrence_range();
revoke all on function public.guard_new_occurrence_range() from public;
revoke all on function public.project_recurring_occurrences(date, date) from public;
grant execute on function public.project_recurring_occurrences(date, date) to authenticated;
