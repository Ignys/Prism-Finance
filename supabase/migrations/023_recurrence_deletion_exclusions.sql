-- A removed durable override must not reappear through the pure projection.
-- Record its global slot in surviving rule revisions, including entity cascades.
create or replace function public.exclude_deleted_recurrence_slot(owner_id uuid, series_id text, ordinal integer, deleting_group_id text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target record; excluded_date text;
begin
    if ordinal is null then return; end if;
    for target in select g.id, g.recurrence_rule as rule from public.transaction_groups g
        where g.user_id = owner_id and g.transaction_mode = 'recurring'
          and coalesce(g.recurrence_rule ->> 'seriesId', g.id) = series_id
          and g.id is distinct from deleting_group_id
    loop
        excluded_date := (((target.rule ->> 'anchorDate')::date + make_interval(months =>
            (ordinal - coalesce((target.rule ->> 'startNumber')::integer, 1)) * (target.rule ->> 'interval')::integer))::date)::text;
        if not coalesce(target.rule -> 'excludedDates', '[]'::jsonb) ? excluded_date then
            update public.transaction_groups set recurrence_rule = jsonb_set(target.rule, '{excludedDates}',
                coalesce(target.rule -> 'excludedDates', '[]'::jsonb) || jsonb_build_array(excluded_date))
             where user_id = owner_id and id = target.id;
        end if;
    end loop;
end;
$$;

create or replace function public.record_deleted_recurrence_slot()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare series_id text; occurrence record;
begin
    if tg_table_name = 'transactions' then
        if old.occurrence_number is null then return old; end if;
        select coalesce(g.recurrence_rule ->> 'seriesId', g.id) into series_id
          from public.transaction_groups g where g.user_id = old.user_id and g.id = old.group_id and g.transaction_mode = 'recurring';
        if series_id is not null then
            perform public.exclude_deleted_recurrence_slot(old.user_id, series_id, old.occurrence_number);
        end if;
    elsif old.transaction_mode = 'recurring' then
        series_id := coalesce(old.recurrence_rule ->> 'seriesId', old.id);
        for occurrence in select occurrence_number from public.transactions
            where user_id = old.user_id and group_id = old.id and occurrence_number is not null
        loop
            perform public.exclude_deleted_recurrence_slot(old.user_id, series_id, occurrence.occurrence_number, old.id);
        end loop;
    end if;
    return old;
end;
$$;

create trigger transactions_record_recurring_deletion before delete on public.transactions
    for each row execute function public.record_deleted_recurrence_slot();
create trigger transaction_groups_record_recurring_deletion before delete on public.transaction_groups
    for each row execute function public.record_deleted_recurrence_slot();
revoke all on function public.exclude_deleted_recurrence_slot(uuid, text, integer, text) from public;
revoke all on function public.record_deleted_recurrence_slot() from public;
