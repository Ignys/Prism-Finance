-- Atomic, unpaginated reads and revision-checked incremental writes.

create table if not exists public.finance_change_log (
    user_id uuid not null references auth.users(id) on delete cascade,
    revision bigint not null,
    client_id text,
    mutation_count integer not null check (mutation_count >= 0),
    mutation_hash text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, revision)
);

alter table public.finance_change_log enable row level security;
drop policy if exists "finance-change-log-own-read" on public.finance_change_log;
create policy "finance-change-log-own-read" on public.finance_change_log
    for select to authenticated using (user_id = auth.uid());

create index if not exists finance_change_log_user_created_idx
    on public.finance_change_log(user_id, created_at desc);

create or replace function public.load_finance_snapshot()
returns jsonb
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
    with current_user_context as (
        select auth.uid() as user_id
    ), snapshot as (
        select
            coalesce((select revision from public.finance_sync_state s where s.user_id = c.user_id), 0) as revision,
            (select to_jsonb(p) from public.finance_preferences p where p.user_id = c.user_id) as preferences,
            coalesce((select jsonb_agg(to_jsonb(w) order by w.id) from public.wallets w where w.user_id = c.user_id), '[]'::jsonb) as wallets,
            coalesce((select jsonb_agg(to_jsonb(cc) order by cc.id) from public.credit_cards cc where cc.user_id = c.user_id), '[]'::jsonb) as credit_cards,
            coalesce((select jsonb_agg(to_jsonb(i) order by i.due_date, i.id) from public.credit_card_invoices i where i.user_id = c.user_id), '[]'::jsonb) as credit_card_invoices,
            coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order, b.id) from public.beneficiaries b where b.user_id = c.user_id), '[]'::jsonb) as beneficiaries,
            coalesce((select jsonb_agg(to_jsonb(cat) order by cat.sort_order, cat.id) from public.categories cat where cat.user_id = c.user_id), '[]'::jsonb) as categories,
            coalesce((select jsonb_agg(to_jsonb(tg) order by tg.sort_order, tg.id) from public.tags tg where tg.user_id = c.user_id), '[]'::jsonb) as tags,
            coalesce((select jsonb_agg(to_jsonb(wi) order by wi.created_at, wi.id) from public.wish_items wi where wi.user_id = c.user_id), '[]'::jsonb) as wish_items,
            coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at, g.id) from public.transaction_groups g where g.user_id = c.user_id), '[]'::jsonb) as transaction_groups,
            coalesce((select jsonb_agg(to_jsonb(t) order by t.scheduled_date, t.id) from public.transactions t where t.user_id = c.user_id), '[]'::jsonb) as transactions,
            coalesce((select jsonb_agg(to_jsonb(le) order by le.created_at, le.id) from public.ledger_entries le where le.user_id = c.user_id), '[]'::jsonb) as ledger_entries,
            coalesce((select jsonb_agg(to_jsonb(tt) order by tt.transaction_id, tt.tag_id) from public.transaction_tags tt where tt.user_id = c.user_id), '[]'::jsonb) as transaction_tags,
            coalesce((select jsonb_agg(to_jsonb(ts) order by ts.version, ts.entity_type, ts.entity_id) from public.finance_tombstones ts where ts.user_id = c.user_id), '[]'::jsonb) as tombstones
        from current_user_context c
        where c.user_id is not null
    )
    select case
        when auth.uid() is null then jsonb_build_object('error', 'FINANCE_AUTH_REQUIRED')
        else jsonb_build_object(
            'revision', coalesce(s.revision, 0),
            'server_time', now(),
            'data', case when s.preferences is null
                              and jsonb_array_length(s.wallets) = 0
                              and jsonb_array_length(s.credit_cards) = 0
                              and jsonb_array_length(s.credit_card_invoices) = 0
                              and jsonb_array_length(s.beneficiaries) = 0
                              and jsonb_array_length(s.categories) = 0
                              and jsonb_array_length(s.tags) = 0
                              and jsonb_array_length(s.wish_items) = 0
                              and jsonb_array_length(s.transaction_groups) = 0
                              and jsonb_array_length(s.transactions) = 0
                              and jsonb_array_length(s.ledger_entries) = 0
                              and jsonb_array_length(s.transaction_tags) = 0
                         then null
                         else jsonb_build_object(
                             'preferences', s.preferences,
                             'wallets', s.wallets,
                             'credit_cards', s.credit_cards,
                             'credit_card_invoices', s.credit_card_invoices,
                             'beneficiaries', s.beneficiaries,
                             'categories', s.categories,
                             'tags', s.tags,
                             'wish_items', s.wish_items,
                             'transaction_groups', s.transaction_groups,
                             'transactions', s.transactions,
                             'ledger_entries', s.ledger_entries,
                             'transaction_tags', s.transaction_tags
                         ) end,
            'tombstones', coalesce(s.tombstones, '[]'::jsonb)
        )
    end
    from snapshot s
    union all
    select jsonb_build_object('error', 'FINANCE_AUTH_REQUIRED')
    where auth.uid() is null
    limit 1;
$$;

create or replace function public.load_finance_changes(since_revision bigint default 0, revision_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with selected_revisions as (
        select l.revision
          from public.finance_change_log l
         where l.user_id = auth.uid() and l.revision > greatest(since_revision, 0)
         order by l.revision
         limit least(greatest(revision_limit, 1), 200)
    ), raw_bounds as (
        select auth.uid() as user_id,
               coalesce((select revision from public.finance_sync_state where user_id = auth.uid()), 0) as current_revision,
               min(revision) as first_revision,
               max(revision) as last_revision,
               count(*)::bigint as revision_count
          from selected_revisions
    ), bounds as (
        select rb.*,
               (
                   greatest(since_revision, 0) > rb.current_revision
                   or (
                       greatest(since_revision, 0) < rb.current_revision
                       and (
                           rb.first_revision is null
                           or rb.first_revision <> greatest(since_revision, 0) + 1
                           or rb.revision_count <> rb.last_revision - greatest(since_revision, 0)
                       )
                   )
               ) as requires_full_reload,
               case
                   when greatest(since_revision, 0) > rb.current_revision
                        or (
                            greatest(since_revision, 0) < rb.current_revision
                            and (
                                rb.first_revision is null
                                or rb.first_revision <> greatest(since_revision, 0) + 1
                                or rb.revision_count <> rb.last_revision - greatest(since_revision, 0)
                            )
                        )
                       then greatest(since_revision, 0)
                   else coalesce(rb.last_revision, greatest(since_revision, 0))
               end as until_revision
          from raw_bounds rb
    )
    select jsonb_build_object(
        'from_revision', greatest(since_revision, 0),
        'until_revision', b.until_revision,
        'current_revision', b.current_revision,
        'has_more', not b.requires_full_reload and b.until_revision > greatest(since_revision, 0) and b.until_revision < b.current_revision,
        'requires_full_reload', b.requires_full_reload,
        'changes', jsonb_build_object(
            'preferences', (select to_jsonb(p) from public.finance_preferences p where p.user_id = b.user_id and p.version > greatest(since_revision, 0) and p.version <= b.until_revision),
            'wallets', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.wallets x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'credit_cards', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.credit_cards x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'beneficiaries', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.beneficiaries x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'categories', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.categories x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'tags', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.tags x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'wish_items', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.wish_items x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'transaction_groups', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.transaction_groups x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'credit_card_invoices', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.credit_card_invoices x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'transactions', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.transactions x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'ledger_entries', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.id) from public.ledger_entries x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'transaction_tags', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.transaction_id, x.tag_id) from public.transaction_tags x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb),
            'tombstones', coalesce((select jsonb_agg(to_jsonb(x) order by x.version, x.entity_type, x.entity_id) from public.finance_tombstones x where x.user_id = b.user_id and x.version > greatest(since_revision, 0) and x.version <= b.until_revision), '[]'::jsonb)
        )
    )
      from bounds b
     where b.user_id is not null;
$$;

create or replace function public.apply_finance_changes(
    expected_revision bigint,
    changes jsonb,
    client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    current_user_id uuid := auth.uid();
    v_current_revision bigint;
    next_revision bigint;
    mutation_count integer;
    target_invoice record;
begin
    if current_user_id is null then
        raise exception 'FINANCE_AUTH_REQUIRED' using errcode = 'P0001';
    end if;
    if jsonb_typeof(changes) is distinct from 'object' then
        raise exception 'FINANCE_CHANGES_INVALID' using errcode = '22023';
    end if;
    if pg_column_size(changes) > 20971520 then
        raise exception 'FINANCE_CHANGES_TOO_LARGE' using errcode = '22023';
    end if;
    if length(coalesce(client_id, '')) > 200 then
        raise exception 'FINANCE_CLIENT_ID_INVALID' using errcode = '22023';
    end if;
    if jsonb_array_length(coalesce(changes #> '{upserts,ledger_entries}', '[]'::jsonb)) > 0
       or exists (
           select 1
             from jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text)
            where d.entity_type = 'ledger_entry'
       ) then
        raise exception 'FINANCE_LEDGER_IS_SERVER_MANAGED' using errcode = '22023';
    end if;

    insert into public.finance_sync_state(user_id, revision, updated_at, updated_by)
    values (current_user_id, 0, now(), client_id)
    on conflict (user_id) do nothing;

    select s.revision into v_current_revision
      from public.finance_sync_state
       as s
     where s.user_id = current_user_id
     for update;

    if v_current_revision is distinct from expected_revision then
        raise exception 'FINANCE_REVISION_CONFLICT:%', v_current_revision using errcode = 'P0001';
    end if;
    next_revision := v_current_revision + 1;

    -- Publish the revision inside the transaction before derived-value triggers
    -- run, so every affected projection receives the same version. Rollback
    -- restores the previous value if any mutation fails.
    update public.finance_sync_state
       set revision = next_revision, updated_at = now(), updated_by = client_id
     where user_id = current_user_id;
    perform set_config('prism.finance_revision', next_revision::text, true);
    perform set_config('prism.finance_client_id', coalesce(client_id, ''), true);

    insert into public.finance_preferences(user_id, favorite_wallet_id, favorite_credit_card_id, planning, updated_at, version)
    values (
        current_user_id,
        nullif(changes #>> '{preferences,favorite_wallet_id}', ''),
        nullif(changes #>> '{preferences,favorite_credit_card_id}', ''),
        coalesce(changes #> '{preferences,planning}', '{}'::jsonb),
        now(),
        next_revision
    )
    on conflict (user_id) do update set
        favorite_wallet_id = excluded.favorite_wallet_id,
        favorite_credit_card_id = excluded.favorite_credit_card_id,
        planning = excluded.planning,
        updated_at = excluded.updated_at,
        version = next_revision;

    insert into public.wallets(user_id, id, name, icon, type, balance, initial_balance, currency, color, is_active, include_in_main_totals, created_at, updated_at, version)
    select current_user_id, id, name, icon, type, initial_balance, initial_balance, currency, color, is_active, include_in_main_totals, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,wallets}', '[]'::jsonb)) as r(
          id text, name text, icon text, type text, balance numeric, initial_balance numeric, currency text, color text,
          is_active boolean, include_in_main_totals boolean, created_at timestamptz)
    on conflict (user_id, id) do update set
        name = excluded.name, icon = excluded.icon, type = excluded.type,
        initial_balance = excluded.initial_balance, currency = excluded.currency, color = excluded.color,
        is_active = excluded.is_active, include_in_main_totals = excluded.include_in_main_totals,
        updated_at = now(), version = next_revision;

    insert into public.credit_cards(user_id, id, name, icon, color, credit_limit, closing_day, due_day, bank_wallet_id, is_active, created_at, updated_at, version)
    select current_user_id, id, name, icon, color, credit_limit, closing_day, due_day, bank_wallet_id, is_active, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,credit_cards}', '[]'::jsonb)) as r(
          id text, name text, icon text, color text, credit_limit numeric, closing_day integer, due_day integer,
          bank_wallet_id text, is_active boolean, created_at timestamptz)
    on conflict (user_id, id) do update set
        name = excluded.name, icon = excluded.icon, color = excluded.color, credit_limit = excluded.credit_limit,
        closing_day = excluded.closing_day, due_day = excluded.due_day, bank_wallet_id = excluded.bank_wallet_id,
        is_active = excluded.is_active, updated_at = now(), version = next_revision;

    insert into public.beneficiaries(user_id, id, family_id, source, is_self_profile, name, type, avatar_color, avatar_image, is_active, sort_order, created_at, updated_at, version)
    select current_user_id, id, family_id, source, is_self_profile, name, type, avatar_color, avatar_image, is_active, sort_order, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,beneficiaries}', '[]'::jsonb)) as r(
          id text, family_id uuid, source text, is_self_profile boolean, name text, type text, avatar_color text,
          avatar_image text, is_active boolean, sort_order integer, created_at timestamptz)
    on conflict (user_id, id) do update set
        family_id = excluded.family_id, source = excluded.source, is_self_profile = excluded.is_self_profile,
        name = excluded.name, type = excluded.type, avatar_color = excluded.avatar_color,
        avatar_image = excluded.avatar_image, is_active = excluded.is_active, sort_order = excluded.sort_order,
        updated_at = now(), version = next_revision;

    insert into public.categories(user_id, id, parent_id, name, type, icon, color, is_active, is_system, sort_order, created_at, updated_at, version)
    select current_user_id, id, parent_id, name, type, icon, color, is_active, is_system, sort_order, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,categories}', '[]'::jsonb)) as r(
          id text, parent_id text, name text, type text, icon text, color text, is_active boolean,
          is_system boolean, sort_order integer, created_at timestamptz)
    on conflict (user_id, id) do update set
        parent_id = excluded.parent_id, name = excluded.name, type = excluded.type, icon = excluded.icon,
        color = excluded.color, is_active = excluded.is_active, is_system = excluded.is_system,
        sort_order = excluded.sort_order, updated_at = now(), version = next_revision;

    insert into public.tags(user_id, id, name, color, is_active, sort_order, created_at, updated_at, version)
    select current_user_id, id, name, color, is_active, sort_order, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,tags}', '[]'::jsonb)) as r(
          id text, name text, color text, is_active boolean, sort_order integer, created_at timestamptz)
    on conflict (user_id, id) do update set
        name = excluded.name, color = excluded.color, is_active = excluded.is_active,
        sort_order = excluded.sort_order, updated_at = now(), version = next_revision;

    insert into public.wish_items(user_id, id, value, category_id, priority, description, link, image_url, is_active, created_at, updated_at, version)
    select current_user_id, id, value, category_id, priority, description, link, image_url, is_active, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,wish_items}', '[]'::jsonb)) as r(
          id text, value numeric, category_id text, priority text, description text, link text,
          image_url text, is_active boolean, created_at timestamptz)
    on conflict (user_id, id) do update set
        value = excluded.value, category_id = excluded.category_id, priority = excluded.priority,
        description = excluded.description, link = excluded.link, image_url = excluded.image_url,
        is_active = excluded.is_active, updated_at = now(), version = next_revision;

    insert into public.transaction_groups(user_id, id, beneficiary_id, beneficiary_name, category_id, category_name, subcategory_name, title, notes, type, transaction_mode, total_amount, installment_count, recurrence_rule, recurrence_end_date, source_wallet_id, destination_wallet_id, credit_card_id, created_at, updated_at, version)
    select current_user_id, id, beneficiary_id, beneficiary_name, category_id, category_name, subcategory_name, title, notes,
           type, transaction_mode, total_amount, installment_count, recurrence_rule, recurrence_end_date,
           source_wallet_id, destination_wallet_id, credit_card_id, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,transaction_groups}', '[]'::jsonb)) as r(
          id text, beneficiary_id text, beneficiary_name text, category_id text, category_name text,
          subcategory_name text, title text, notes text, type text, transaction_mode text, total_amount numeric,
          installment_count integer, recurrence_rule jsonb, recurrence_end_date date, source_wallet_id text,
          destination_wallet_id text, credit_card_id text, created_at timestamptz)
    on conflict (user_id, id) do update set
        beneficiary_id = excluded.beneficiary_id, beneficiary_name = excluded.beneficiary_name,
        category_id = excluded.category_id, category_name = excluded.category_name,
        subcategory_name = excluded.subcategory_name, title = excluded.title, notes = excluded.notes,
        type = excluded.type, transaction_mode = excluded.transaction_mode, total_amount = excluded.total_amount,
        installment_count = excluded.installment_count, recurrence_rule = excluded.recurrence_rule,
        recurrence_end_date = excluded.recurrence_end_date, source_wallet_id = excluded.source_wallet_id,
        destination_wallet_id = excluded.destination_wallet_id, credit_card_id = excluded.credit_card_id,
        updated_at = now(), version = next_revision;

    insert into public.credit_card_invoices(user_id, id, credit_card_id, cycle_key, closing_date, due_date, total_amount, paid_amount, status, paid_at, created_at, updated_at, version)
    select current_user_id, id, credit_card_id, cycle_key, closing_date, due_date, total_amount, paid_amount,
           status, paid_at, created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,credit_card_invoices}', '[]'::jsonb)) as r(
          id text, credit_card_id text, cycle_key text, closing_date date, due_date date, total_amount numeric,
          paid_amount numeric, status text, paid_at timestamptz, created_at timestamptz, updated_at timestamptz)
    on conflict (user_id, id) do update set
        credit_card_id = excluded.credit_card_id, cycle_key = excluded.cycle_key,
        closing_date = excluded.closing_date, due_date = excluded.due_date,
        paid_amount = excluded.paid_amount, status = excluded.status, paid_at = excluded.paid_at,
        updated_at = now(), version = next_revision;

    insert into public.transactions(user_id, id, group_id, installment_number, amount, scheduled_date, status, paid_at, invoice_id, payment_for_invoice_id, notes, title, category_id, beneficiary_id, source_wallet_id, destination_wallet_id, credit_card_id, created_at, updated_at, version)
    select current_user_id, id, group_id, installment_number, amount, scheduled_date, status, paid_at, invoice_id, payment_for_invoice_id,
           notes, title, category_id, beneficiary_id, source_wallet_id, destination_wallet_id, credit_card_id,
           created_at, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,transactions}', '[]'::jsonb)) as r(
          id text, group_id text, installment_number integer, amount numeric, scheduled_date date,
          status text, paid_at timestamptz, invoice_id text, payment_for_invoice_id text, notes text, title text, category_id text,
          beneficiary_id text, source_wallet_id text, destination_wallet_id text, credit_card_id text,
          created_at timestamptz)
    on conflict (user_id, id) do update set
        group_id = excluded.group_id, installment_number = excluded.installment_number, amount = excluded.amount,
        scheduled_date = excluded.scheduled_date, status = excluded.status, paid_at = excluded.paid_at,
        invoice_id = excluded.invoice_id, payment_for_invoice_id = excluded.payment_for_invoice_id,
        notes = excluded.notes, title = excluded.title,
        category_id = excluded.category_id, beneficiary_id = excluded.beneficiary_id,
        source_wallet_id = excluded.source_wallet_id, destination_wallet_id = excluded.destination_wallet_id,
        credit_card_id = excluded.credit_card_id, updated_at = now(), version = next_revision;

    insert into public.transaction_tags(user_id, transaction_id, tag_id, updated_at, version)
    select current_user_id, transaction_id, tag_id, now(), next_revision
      from jsonb_to_recordset(coalesce(changes #> '{upserts,transaction_tags}', '[]'::jsonb)) as r(transaction_id text, tag_id text)
    on conflict (user_id, transaction_id, tag_id) do update set updated_at = now(), version = next_revision;

    -- An explicit upsert is the only supported way to supersede a tombstone.
    delete from public.finance_tombstones ts
     where ts.user_id = current_user_id and (
        (ts.entity_type = 'wallet' and exists (select 1 from public.wallets x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'credit_card' and exists (select 1 from public.credit_cards x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'beneficiary' and exists (select 1 from public.beneficiaries x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'category' and exists (select 1 from public.categories x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'tag' and exists (select 1 from public.tags x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'wish_item' and exists (select 1 from public.wish_items x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'transaction_group' and exists (select 1 from public.transaction_groups x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'credit_card_invoice' and exists (select 1 from public.credit_card_invoices x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'transaction' and exists (select 1 from public.transactions x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'ledger_entry' and exists (select 1 from public.ledger_entries x where x.user_id = current_user_id and x.id = ts.entity_id and x.version = next_revision)) or
        (ts.entity_type = 'transaction_tag' and exists (select 1 from public.transaction_tags x where x.user_id = current_user_id and x.transaction_id = ts.entity_id and x.tag_id = ts.related_id and x.version = next_revision))
     );

    insert into public.finance_tombstones(user_id, entity_type, entity_id, related_id, version, deleted_at, deleted_by)
    select current_user_id, entity_type, entity_id, coalesce(related_id, ''), next_revision, now(), client_id
      from jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as r(entity_type text, entity_id text, related_id text)
     where nullif(entity_id, '') is not null
    on conflict (user_id, entity_type, entity_id, related_id) do update set
        version = excluded.version, deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by;

    delete from public.transaction_tags x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text, related_id text)
     where x.user_id = current_user_id and d.entity_type = 'transaction_tag' and x.transaction_id = d.entity_id and x.tag_id = d.related_id;
    delete from public.transactions x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'transaction' and x.id = d.entity_id;
    delete from public.credit_card_invoices x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'credit_card_invoice' and x.id = d.entity_id;
    delete from public.transaction_groups x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'transaction_group' and x.id = d.entity_id;
    delete from public.wish_items x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'wish_item' and x.id = d.entity_id;
    delete from public.tags x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'tag' and x.id = d.entity_id;
    delete from public.categories x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'category' and x.id = d.entity_id;
    delete from public.beneficiaries x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'beneficiary' and x.id = d.entity_id;
    delete from public.credit_cards x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'credit_card' and x.id = d.entity_id;
    delete from public.wallets x using jsonb_to_recordset(coalesce(changes -> 'deletes', '[]'::jsonb)) as d(entity_type text, entity_id text)
     where x.user_id = current_user_id and d.entity_type = 'wallet' and x.id = d.entity_id;

    -- Covers invoices inserted without any transaction rows in this change.
    for target_invoice in
        select id
          from jsonb_to_recordset(coalesce(changes #> '{upserts,credit_card_invoices}', '[]'::jsonb)) as r(id text)
    loop
        perform public.recompute_credit_card_invoice(current_user_id, target_invoice.id);
    end loop;

    update public.finance_sync_state
       set revision = next_revision, updated_at = now(), updated_by = client_id
     where user_id = current_user_id;

    mutation_count :=
        jsonb_array_length(coalesce(changes -> 'deletes', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,wallets}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,credit_cards}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,beneficiaries}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,categories}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,tags}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,wish_items}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,transaction_groups}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,credit_card_invoices}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,transactions}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,ledger_entries}', '[]'::jsonb)) +
        jsonb_array_length(coalesce(changes #> '{upserts,transaction_tags}', '[]'::jsonb));

    insert into public.finance_change_log(user_id, revision, client_id, mutation_count, mutation_hash)
    values (current_user_id, next_revision, client_id, mutation_count, encode(digest(changes::text, 'sha256'::text), 'hex'));

    return jsonb_build_object(
        'revision', next_revision,
        'snapshot', public.load_finance_snapshot()
    );
end;
$$;

create or replace function public.filter_legacy_finance_upserts(
    target_user_id uuid,
    target_entity_type text,
    candidate_rows jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(jsonb_agg(candidate), '[]'::jsonb)
      from jsonb_array_elements(coalesce(candidate_rows, '[]'::jsonb)) candidate
     where not exists (
         select 1
           from public.finance_tombstones ts
          where ts.user_id = target_user_id
            and ts.entity_type = target_entity_type
            and ts.entity_id = case
                when target_entity_type = 'transaction_tag' then candidate ->> 'transaction_id'
                else candidate ->> 'id'
            end
            and ts.related_id = case
                when target_entity_type = 'transaction_tag' then coalesce(candidate ->> 'tag_id', '')
                else ''
            end
     );
$$;

-- Compatibility adapter for an old frontend during rollout. Missing rows are
-- never interpreted as deletes: an empty/truncated client snapshot can upsert
-- data but cannot erase canonical rows. Existing tombstones also block a stale
-- snapshot from resurrecting deleted entities. Explicit deletion/recreation
-- requires the new RPC.
create or replace function public.save_finance_snapshot(
    expected_revision bigint,
    payload jsonb,
    client_id text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    result jsonb;
begin
    result := public.apply_finance_changes(
        expected_revision,
        jsonb_build_object(
            'preferences', coalesce(payload -> 'preferences', '{}'::jsonb),
            'upserts', jsonb_build_object(
                'wallets', public.filter_legacy_finance_upserts(auth.uid(), 'wallet', payload -> 'wallets'),
                'credit_cards', public.filter_legacy_finance_upserts(auth.uid(), 'credit_card', payload -> 'credit_cards'),
                'beneficiaries', public.filter_legacy_finance_upserts(auth.uid(), 'beneficiary', payload -> 'beneficiaries'),
                'categories', public.filter_legacy_finance_upserts(auth.uid(), 'category', payload -> 'categories'),
                'tags', public.filter_legacy_finance_upserts(auth.uid(), 'tag', payload -> 'tags'),
                'wish_items', public.filter_legacy_finance_upserts(auth.uid(), 'wish_item', payload -> 'wish_items'),
                'transaction_groups', public.filter_legacy_finance_upserts(auth.uid(), 'transaction_group', payload -> 'transaction_groups'),
                'credit_card_invoices', public.filter_legacy_finance_upserts(auth.uid(), 'credit_card_invoice', payload -> 'credit_card_invoices'),
                'transactions', public.filter_legacy_finance_upserts(auth.uid(), 'transaction', payload -> 'transactions'),
                'ledger_entries', '[]'::jsonb,
                'transaction_tags', public.filter_legacy_finance_upserts(auth.uid(), 'transaction_tag', payload -> 'transaction_tags')
            ),
            'deletes', '[]'::jsonb
        ),
        coalesce(client_id, 'legacy') || ':safe-snapshot-adapter'
    );
    return (result ->> 'revision')::bigint;
end;
$$;

revoke insert, update, delete on public.finance_preferences from anon, authenticated;
revoke insert, update, delete on public.wallets from anon, authenticated;
revoke insert, update, delete on public.credit_cards from anon, authenticated;
revoke insert, update, delete on public.beneficiaries from anon, authenticated;
revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.tags from anon, authenticated;
revoke insert, update, delete on public.wish_items from anon, authenticated;
revoke insert, update, delete on public.transaction_groups from anon, authenticated;
revoke insert, update, delete on public.credit_card_invoices from anon, authenticated;
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.ledger_entries from anon, authenticated;
revoke insert, update, delete on public.transaction_tags from anon, authenticated;
revoke insert, update, delete on public.finance_sync_state from anon, authenticated;
revoke insert, update, delete on public.finance_tombstones from anon, authenticated;
revoke insert, update, delete on public.finance_change_log from anon, authenticated;

revoke all on function public.load_finance_snapshot() from public;
revoke all on function public.load_finance_changes(bigint, integer) from public;
revoke all on function public.apply_finance_changes(bigint, jsonb, text) from public;
revoke all on function public.filter_legacy_finance_upserts(uuid, text, jsonb) from public;
grant execute on function public.load_finance_snapshot() to authenticated;
grant execute on function public.load_finance_changes(bigint, integer) to authenticated;
grant execute on function public.apply_finance_changes(bigint, jsonb, text) to authenticated;
revoke all on function public.save_finance_snapshot(bigint, jsonb, text) from public;
grant execute on function public.save_finance_snapshot(bigint, jsonb, text) to authenticated;
