-- Rules are canonical; forecasts are read models. Retain legacy rows (and all
-- their attachments/tags) as explicit exceptions instead of guessing user intent.
alter table public.transactions add column occurrence_number integer;
alter table public.transactions add column commitment text not null default 'posted';
alter table public.transactions add constraint transactions_occurrence_number_check check (occurrence_number is null or occurrence_number > 0);
alter table public.transactions add constraint transactions_commitment_check check (commitment in ('forecast', 'posted'));
-- Install the index before backfilling rows: deferred foreign-key events from
-- existing data otherwise prevent CREATE INDEX in the migration transaction.
create unique index transactions_group_occurrence_unique on public.transactions(user_id, group_id, occurrence_number) where occurrence_number is not null;

update public.transaction_groups g
   set recurrence_rule = coalesce(g.recurrence_rule, '{}'::jsonb) || jsonb_build_object(
       'frequency', 'monthly', 'seriesId', g.id, 'startNumber', 1,
       'anchorDate', coalesce(g.recurrence_rule ->> 'anchorDate', (select min(t.scheduled_date)::text from public.transactions t where t.user_id = g.user_id and t.group_id = g.id), g.created_at::date::text),
       'amount', coalesce((g.recurrence_rule ->> 'amount')::numeric, (select abs(t.amount) from public.transactions t where t.user_id = g.user_id and t.group_id = g.id order by t.scheduled_date, t.id limit 1), 0.01),
       'interval', coalesce((g.recurrence_rule ->> 'interval')::integer, 1),
       'end', coalesce(g.recurrence_rule -> 'end', jsonb_build_object('type', 'never')),
       'tagIds', coalesce(g.recurrence_rule -> 'tagIds', '[]'::jsonb),
       'excludedDates', coalesce(g.recurrence_rule -> 'excludedDates', '[]'::jsonb),
       'notes', coalesce(g.recurrence_rule -> 'notes', to_jsonb(g.notes)))
 where g.transaction_mode = 'recurring';

-- Stable monthly ordinals also identify legacy month-end drift/individual date
-- overrides. Ambiguous duplicates are preserved and suppress their projected slot.
with numbered as (
    select t.user_id, t.id, t.group_id,
           greatest(1, 1 + floor((12 * (extract(year from t.scheduled_date) - extract(year from (g.recurrence_rule ->> 'anchorDate')::date))
             + extract(month from t.scheduled_date) - extract(month from (g.recurrence_rule ->> 'anchorDate')::date)) / (g.recurrence_rule ->> 'interval')::integer))::integer as ordinal
      from public.transactions t join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
     where g.transaction_mode = 'recurring'
), unique_numbers as (
    select *, count(*) over (partition by user_id, group_id, ordinal) as siblings from numbered
)
update public.transactions t set occurrence_number = n.ordinal
  from unique_numbers n where n.user_id = t.user_id and n.id = t.id and n.siblings = 1;

-- A legacy date override may place two rows in one month and leave a hole in
-- another. Keep every financial field and assign the ambiguous rows to the
-- nearest unused ordinal, deterministically. Never project a replacement for
-- an existing moved occurrence merely because its former month is now empty.
do $$
declare item record; ordinal_limit integer; preferred_number integer; assigned_number integer;
begin
    for item in
        select t.user_id, t.id, t.group_id, t.scheduled_date, g.recurrence_rule
          from public.transactions t join public.transaction_groups g on g.user_id=t.user_id and g.id=t.group_id
         where g.transaction_mode='recurring' and t.occurrence_number is null
         order by t.user_id, t.group_id, t.scheduled_date, t.id
    loop
        preferred_number := greatest(1, 1 + floor((12 * (extract(year from item.scheduled_date) - extract(year from (item.recurrence_rule ->> 'anchorDate')::date))
            + extract(month from item.scheduled_date) - extract(month from (item.recurrence_rule ->> 'anchorDate')::date)) / (item.recurrence_rule ->> 'interval')::integer))::integer;
        select greatest(preferred_number, coalesce(max(t.occurrence_number),0)) + count(*)::integer
          into ordinal_limit from public.transactions t where t.user_id=item.user_id and t.group_id=item.group_id;
        select n into assigned_number from generate_series(1,ordinal_limit) n
         where not exists(select 1 from public.transactions t where t.user_id=item.user_id and t.group_id=item.group_id and t.occurrence_number=n)
         order by abs(n-preferred_number), n limit 1;
        update public.transactions set occurrence_number=assigned_number where user_id=item.user_id and id=item.id;
    end loop;
end;
$$;

-- Only future, unpaid card recurrences become forecasts. Settled history and
-- installments keep their commitment and their relational payment links.
update public.transactions t set commitment = 'forecast'
  from public.transaction_groups g
 where g.user_id = t.user_id and g.id = t.group_id and g.transaction_mode = 'recurring'
   and coalesce(t.credit_card_id, g.credit_card_id) is not null
   and t.scheduled_date > (now() at time zone 'America/Sao_Paulo')::date
   and t.status = 'pending'
   and not exists (select 1 from public.credit_card_invoices i where i.user_id = t.user_id and i.id = t.invoice_id and i.paid_amount > 0);


-- Extend the canonical batched writer in place. Assertions deliberately fail
-- the migration if its prerequisite function differs, rather than losing fields.
do $$
declare definition text;
begin
    definition := pg_get_functiondef('public.apply_finance_changes_rowwise(bigint,jsonb,text)'::regprocedure);
    if position('group_id, installment_number, amount, scheduled_date' in definition) = 0 then raise exception 'Unexpected finance writer shape'; end if;
    definition := replace(definition, 'group_id, installment_number, amount, scheduled_date', 'group_id, installment_number, occurrence_number, commitment, amount, scheduled_date');
    definition := replace(definition, 'id, group_id, installment_number, occurrence_number, commitment, amount, scheduled_date, status, paid_at, invoice_id, payment_for_invoice_id,' || chr(10),
        'id, group_id, installment_number, occurrence_number, coalesce(r.commitment, (select t.commitment from public.transactions t where t.user_id = current_user_id and t.id = r.id), ''posted''), amount, scheduled_date, status, paid_at, invoice_id, payment_for_invoice_id,' || chr(10));
    definition := replace(definition, 'installment_number integer, amount numeric', 'installment_number integer, occurrence_number integer, commitment text, amount numeric');
    definition := replace(definition, 'installment_number = excluded.installment_number, amount = excluded.amount', 'installment_number = excluded.installment_number, occurrence_number = coalesce(excluded.occurrence_number, transactions.occurrence_number), commitment = excluded.commitment, amount = excluded.amount');
    execute definition;

    definition := pg_get_functiondef('public.sync_finance_transactions_batch(jsonb,jsonb)'::regprocedure);
    if position('t.invoice_id = d.invoice_id and t.status not in' in definition) = 0 then raise exception 'Unexpected invoice projection shape'; end if;
    definition := replace(definition, 't.invoice_id = d.invoice_id and t.status not in', 't.invoice_id = d.invoice_id and t.commitment = ''posted'' and t.status not in');
    execute definition;
    definition := pg_get_functiondef('public.recompute_credit_card_invoice(uuid,text)'::regprocedure);
    definition := replace(definition, 'where status not in', 'where commitment = ''posted'' and status not in');
    execute definition;
    definition := pg_get_functiondef('public.sync_transactions_from_statement()'::regprocedure);
    definition := replace(definition, 'where n.group_id is distinct from o.group_id', 'where n.commitment is distinct from o.commitment or n.group_id is distinct from o.group_id');
    execute definition;
end;
$$;

create or replace function public.validate_recurrence_rule()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare rule jsonb; field_name text; item jsonb; date_text text;
begin
    if new.transaction_mode <> 'recurring' then return new; end if;
    rule := new.recurrence_rule;
    if jsonb_typeof(rule) is distinct from 'object'
       or jsonb_typeof(rule -> 'amount') is distinct from 'number'
       or round((rule ->> 'amount')::numeric, 2) < 0.01
       or jsonb_typeof(rule -> 'end') is distinct from 'object'
    then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
    foreach field_name in array array['interval', 'startNumber', 'stopNumber'] loop
        if rule ? field_name and (jsonb_typeof(rule -> field_name) <> 'number'
           or (rule ->> field_name)::numeric <> trunc((rule ->> field_name)::numeric))
        then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
    end loop;
    if rule #>> '{end,type}' = 'count' and (jsonb_typeof(rule #> '{end,count}') is distinct from 'number'
       or (rule #>> '{end,count}')::numeric <> trunc((rule #>> '{end,count}')::numeric))
    then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
    foreach field_name in array array['tagIds', 'excludedDates'] loop
        if not rule ? field_name then continue; end if;
        if jsonb_typeof(rule -> field_name) <> 'array'
        then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
        for item in select value from jsonb_array_elements(rule -> field_name) loop
            if jsonb_typeof(item) <> 'string'
            then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
            if field_name = 'excludedDates' then
                date_text := item #>> '{}';
                if date_text !~ '^\d{4}-\d{2}-\d{2}$' or to_char(date_text::date, 'YYYY-MM-DD') <> date_text
                then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
            end if;
        end loop;
    end loop;
    foreach field_name in array array['anchorDate', 'untilDate'] loop
        date_text := case when field_name = 'anchorDate' then rule ->> 'anchorDate'
            when rule #>> '{end,type}' = 'until' then rule #>> '{end,date}' else null end;
        if date_text is not null and (date_text !~ '^\d{4}-\d{2}-\d{2}$' or to_char(date_text::date, 'YYYY-MM-DD') <> date_text)
        then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
    end loop;
    if rule is null or rule ->> 'frequency' is distinct from 'monthly'
       or (rule ->> 'amount')::numeric <= 0 or (rule ->> 'interval')::integer < 1
       or rule ->> 'anchorDate' is null or rule ->> 'amount' is null or rule ->> 'interval' is null
       or rule #>> '{end,type}' is null or rule #>> '{end,type}' not in ('never', 'count', 'until')
       or (rule #>> '{end,type}' = 'count' and coalesce((rule #>> '{end,count}')::integer, 0) < 1)
       or (rule #>> '{end,type}' = 'until' and rule #>> '{end,date}' is null)
       or coalesce((rule ->> 'startNumber')::integer, 1) < 1 or coalesce((rule ->> 'stopNumber')::integer, 0) < 0
    then raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514'; end if;
    perform (rule ->> 'anchorDate')::date;
    if rule #>> '{end,type}' = 'until' then perform (rule #>> '{end,date}')::date; end if;
    new.recurrence_rule := rule || jsonb_build_object('seriesId', coalesce(rule ->> 'seriesId', new.id), 'amount', round((rule ->> 'amount')::numeric, 2));
    return new;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
    raise exception 'INVALID_RECURRENCE_RULE' using errcode = '23514';
end;
$$;
create trigger transaction_groups_validate_recurrence before insert or update on public.transaction_groups for each row execute function public.validate_recurrence_rule();

create or replace function public.assert_occurrence_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare series_id text; occurrence_count integer;
begin
    if new.occurrence_number is null then return new; end if;
    select coalesce(g.recurrence_rule ->> 'seriesId', g.id) into series_id
      from public.transaction_groups g where g.user_id = new.user_id and g.id = new.group_id and g.transaction_mode = 'recurring';
    if series_id is null then raise exception 'OCCURRENCE_REQUIRES_RECURRING_GROUP' using errcode = '23514'; end if;
    select count(*) into occurrence_count from public.transactions t join public.transaction_groups g on g.user_id = t.user_id and g.id = t.group_id
     where t.user_id = new.user_id and t.occurrence_number = new.occurrence_number and coalesce(g.recurrence_rule ->> 'seriesId', g.id) = series_id;
    if occurrence_count > 1 then raise exception 'DUPLICATE_RECURRENCE_OCCURRENCE' using errcode = '23514'; end if;
    return new;
end;
$$;
create constraint trigger transactions_validate_occurrence after insert or update on public.transactions deferrable initially deferred for each row execute function public.assert_occurrence_identity();

-- Refresh forecasts once during migration. Ordinary reads perform no writes.
do $$ declare target record;
begin
    for target in select user_id, jsonb_agg(to_jsonb(t)) as rows from public.transactions t group by user_id loop
        perform public.sync_finance_transactions_batch('[]'::jsonb, target.rows);
    end loop;
end; $$;

revoke all on function public.validate_recurrence_rule() from public;
revoke all on function public.assert_occurrence_identity() from public;
notify pgrst, 'reload schema';
