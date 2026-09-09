create or replace function public.recurrence_last_number(rule jsonb, end_date date)
returns integer language plpgsql immutable set search_path = public, pg_temp as $$
declare last_number integer := least(coalesce((rule ->> 'stopNumber')::integer, 2147483647),
    case when rule #>> '{end,type}' = 'count' then (rule #>> '{end,count}')::integer else 2147483647 end);
    until_date date := least(end_date, case when rule #>> '{end,type}' = 'until' then (rule #>> '{end,date}')::date end);
    anchor date := (rule ->> 'anchorDate')::date;
    month_interval integer := (rule ->> 'interval')::integer;
    first_number integer := coalesce((rule ->> 'startNumber')::integer, 1);
    until_number integer;
begin
    if until_date is not null then
        until_number := first_number + floor((12 * (extract(year from until_date) - extract(year from anchor)) + extract(month from until_date) - extract(month from anchor)) / month_interval)::integer;
        if (anchor + make_interval(months => (until_number - first_number) * month_interval))::date > until_date then until_number := until_number - 1; end if;
        last_number := least(last_number, until_number);
    end if;
    return last_number;
end;
$$;

create or replace function public.assert_recurrence_segments()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
    if exists (
        select 1 from public.transaction_groups a join public.transaction_groups b on b.user_id = a.user_id and b.id > a.id
         where a.user_id = new.user_id and a.transaction_mode = 'recurring' and b.transaction_mode = 'recurring'
           and coalesce(a.recurrence_rule ->> 'seriesId', a.id) = coalesce(b.recurrence_rule ->> 'seriesId', b.id)
           and coalesce((a.recurrence_rule ->> 'startNumber')::integer, 1) <= public.recurrence_last_number(a.recurrence_rule, a.recurrence_end_date)
           and coalesce((b.recurrence_rule ->> 'startNumber')::integer, 1) <= public.recurrence_last_number(b.recurrence_rule, b.recurrence_end_date)
           and coalesce((a.recurrence_rule ->> 'startNumber')::integer, 1) <= public.recurrence_last_number(b.recurrence_rule, b.recurrence_end_date)
           and coalesce((b.recurrence_rule ->> 'startNumber')::integer, 1) <= public.recurrence_last_number(a.recurrence_rule, a.recurrence_end_date)
    ) then raise exception 'OVERLAPPING_RECURRENCE_SEGMENTS' using errcode = '23514'; end if;
    return new;
end;
$$;
create constraint trigger transaction_groups_no_overlapping_recurrence after insert or update on public.transaction_groups deferrable initially deferred for each row execute function public.assert_recurrence_segments();

-- Deliberate revision gap: existing devices must fetch an atomic full snapshot
-- after this schema/data migration, rather than retaining pre-migration rows.
insert into public.finance_sync_state(user_id, revision, updated_at, updated_by)
select distinct user_id, 1, now(), 'migration:recurrence-v2' from public.transaction_groups where transaction_mode = 'recurring'
on conflict (user_id) do update set revision = finance_sync_state.revision + 1, updated_at = now(), updated_by = 'migration:recurrence-v2';
revoke all on function public.recurrence_last_number(jsonb, date) from public;
revoke all on function public.assert_recurrence_segments() from public;
