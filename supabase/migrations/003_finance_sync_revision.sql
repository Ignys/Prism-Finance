create table if not exists public.finance_sync_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    revision bigint not null default 0 check (revision >= 0),
    updated_at timestamptz not null default now(),
    updated_by text
);

alter table public.finance_sync_state enable row level security;

drop policy if exists "finance-sync-state-own-all" on public.finance_sync_state;
create policy "finance-sync-state-own-all" on public.finance_sync_state
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
    alter publication supabase_realtime add table public.finance_sync_state;
exception
    when duplicate_object then null;
    when undefined_object then null;
end $$;

create or replace function public.save_finance_snapshot(
    expected_revision bigint,
    payload jsonb,
    client_id text
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_current_revision bigint;
    v_next_revision bigint;
begin
    if v_user_id is null then
        raise exception 'FINANCE_AUTH_REQUIRED' using errcode = 'P0001';
    end if;

    insert into public.finance_sync_state (user_id, revision, updated_at, updated_by)
    values (v_user_id, 0, now(), client_id)
    on conflict (user_id) do nothing;

    select revision
      into v_current_revision
      from public.finance_sync_state
     where user_id = v_user_id
     for update;

    if v_current_revision is distinct from expected_revision then
        raise exception 'FINANCE_REVISION_CONFLICT:%', v_current_revision using errcode = 'P0001';
    end if;

    insert into public.finance_preferences (
        user_id,
        favorite_wallet_id,
        favorite_credit_card_id,
        planning,
        updated_at
    )
    values (
        v_user_id,
        nullif(payload #>> '{preferences,favorite_wallet_id}', ''),
        nullif(payload #>> '{preferences,favorite_credit_card_id}', ''),
        coalesce(payload #> '{preferences,planning}', '{}'::jsonb),
        now()
    )
    on conflict (user_id) do update set
        favorite_wallet_id = excluded.favorite_wallet_id,
        favorite_credit_card_id = excluded.favorite_credit_card_id,
        planning = excluded.planning,
        updated_at = excluded.updated_at;

    insert into public.wallets (
        user_id, id, name, icon, type, balance, initial_balance, currency, color,
        is_active, include_in_main_totals, created_at
    )
    select v_user_id, id, name, icon, type, balance, initial_balance, currency, color,
           is_active, include_in_main_totals, created_at
      from jsonb_to_recordset(coalesce(payload -> 'wallets', '[]'::jsonb)) as rows(
        id text, name text, icon text, type text, balance numeric, initial_balance numeric,
        currency text, color text, is_active boolean, include_in_main_totals boolean, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        name = excluded.name,
        icon = excluded.icon,
        type = excluded.type,
        balance = excluded.balance,
        initial_balance = excluded.initial_balance,
        currency = excluded.currency,
        color = excluded.color,
        is_active = excluded.is_active,
        include_in_main_totals = excluded.include_in_main_totals,
        created_at = excluded.created_at;

    insert into public.credit_cards (
        user_id, id, name, icon, color, credit_limit, closing_day, due_day,
        bank_wallet_id, is_active, created_at
    )
    select v_user_id, id, name, icon, color, credit_limit, closing_day, due_day,
           bank_wallet_id, is_active, created_at
      from jsonb_to_recordset(coalesce(payload -> 'credit_cards', '[]'::jsonb)) as rows(
        id text, name text, icon text, color text, credit_limit numeric, closing_day integer,
        due_day integer, bank_wallet_id text, is_active boolean, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        name = excluded.name,
        icon = excluded.icon,
        color = excluded.color,
        credit_limit = excluded.credit_limit,
        closing_day = excluded.closing_day,
        due_day = excluded.due_day,
        bank_wallet_id = excluded.bank_wallet_id,
        is_active = excluded.is_active,
        created_at = excluded.created_at;

    insert into public.beneficiaries (
        user_id, id, family_id, source, is_self_profile, name, type, avatar_color,
        avatar_image, is_active, sort_order, created_at
    )
    select v_user_id, id, family_id, source, is_self_profile, name, type, avatar_color,
           avatar_image, is_active, sort_order, created_at
      from jsonb_to_recordset(coalesce(payload -> 'beneficiaries', '[]'::jsonb)) as rows(
        id text, family_id uuid, source text, is_self_profile boolean, name text,
        type text, avatar_color text, avatar_image text, is_active boolean,
        sort_order integer, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        family_id = excluded.family_id,
        source = excluded.source,
        is_self_profile = excluded.is_self_profile,
        name = excluded.name,
        type = excluded.type,
        avatar_color = excluded.avatar_color,
        avatar_image = excluded.avatar_image,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        created_at = excluded.created_at;

    insert into public.categories (
        user_id, id, parent_id, name, type, icon, color, is_active,
        is_system, sort_order, created_at
    )
    select v_user_id, id, parent_id, name, type, icon, color, is_active,
           is_system, sort_order, created_at
      from jsonb_to_recordset(coalesce(payload -> 'categories', '[]'::jsonb)) as rows(
        id text, parent_id text, name text, type text, icon text, color text,
        is_active boolean, is_system boolean, sort_order integer, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        parent_id = excluded.parent_id,
        name = excluded.name,
        type = excluded.type,
        icon = excluded.icon,
        color = excluded.color,
        is_active = excluded.is_active,
        is_system = excluded.is_system,
        sort_order = excluded.sort_order,
        created_at = excluded.created_at;

    insert into public.tags (
        user_id, id, name, color, is_active, sort_order, created_at
    )
    select v_user_id, id, name, color, is_active, sort_order, created_at
      from jsonb_to_recordset(coalesce(payload -> 'tags', '[]'::jsonb)) as rows(
        id text, name text, color text, is_active boolean, sort_order integer, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        name = excluded.name,
        color = excluded.color,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        created_at = excluded.created_at;

    insert into public.wish_items (
        user_id, id, value, category_id, priority, description, link,
        image_url, is_active, created_at
    )
    select v_user_id, id, value, category_id, priority, description, link,
           image_url, is_active, created_at
      from jsonb_to_recordset(coalesce(payload -> 'wish_items', '[]'::jsonb)) as rows(
        id text, value numeric, category_id text, priority text, description text,
        link text, image_url text, is_active boolean, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        value = excluded.value,
        category_id = excluded.category_id,
        priority = excluded.priority,
        description = excluded.description,
        link = excluded.link,
        image_url = excluded.image_url,
        is_active = excluded.is_active,
        created_at = excluded.created_at;

    insert into public.transaction_groups (
        user_id, id, beneficiary_id, beneficiary_name, category_id, category_name,
        subcategory_name, title, notes, type, transaction_mode, total_amount,
        installment_count, recurrence_rule, recurrence_end_date, source_wallet_id,
        destination_wallet_id, credit_card_id, created_at
    )
    select v_user_id, id, beneficiary_id, beneficiary_name, category_id, category_name,
           subcategory_name, title, notes, type, transaction_mode, total_amount,
           installment_count, recurrence_rule, recurrence_end_date, source_wallet_id,
           destination_wallet_id, credit_card_id, created_at
      from jsonb_to_recordset(coalesce(payload -> 'transaction_groups', '[]'::jsonb)) as rows(
        id text, beneficiary_id text, beneficiary_name text, category_id text,
        category_name text, subcategory_name text, title text, notes text, type text,
        transaction_mode text, total_amount numeric, installment_count integer,
        recurrence_rule jsonb, recurrence_end_date date, source_wallet_id text,
        destination_wallet_id text, credit_card_id text, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        beneficiary_id = excluded.beneficiary_id,
        beneficiary_name = excluded.beneficiary_name,
        category_id = excluded.category_id,
        category_name = excluded.category_name,
        subcategory_name = excluded.subcategory_name,
        title = excluded.title,
        notes = excluded.notes,
        type = excluded.type,
        transaction_mode = excluded.transaction_mode,
        total_amount = excluded.total_amount,
        installment_count = excluded.installment_count,
        recurrence_rule = excluded.recurrence_rule,
        recurrence_end_date = excluded.recurrence_end_date,
        source_wallet_id = excluded.source_wallet_id,
        destination_wallet_id = excluded.destination_wallet_id,
        credit_card_id = excluded.credit_card_id,
        created_at = excluded.created_at;

    insert into public.credit_card_invoices (
        user_id, id, credit_card_id, cycle_key, closing_date, due_date,
        total_amount, paid_amount, status, paid_at, created_at, updated_at
    )
    select v_user_id, id, credit_card_id, cycle_key, closing_date, due_date,
           total_amount, paid_amount, status, paid_at, created_at, updated_at
      from jsonb_to_recordset(coalesce(payload -> 'credit_card_invoices', '[]'::jsonb)) as rows(
        id text, credit_card_id text, cycle_key text, closing_date date, due_date date,
        total_amount numeric, paid_amount numeric, status text, paid_at timestamptz,
        created_at timestamptz, updated_at timestamptz
      )
    on conflict (user_id, id) do update set
        credit_card_id = excluded.credit_card_id,
        cycle_key = excluded.cycle_key,
        closing_date = excluded.closing_date,
        due_date = excluded.due_date,
        total_amount = excluded.total_amount,
        paid_amount = excluded.paid_amount,
        status = excluded.status,
        paid_at = excluded.paid_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

    insert into public.transactions (
        user_id, id, group_id, installment_number, amount, scheduled_date,
        status, paid_at, invoice_id, notes, title, category_id, beneficiary_id,
        source_wallet_id, destination_wallet_id, credit_card_id, created_at
    )
    select v_user_id, id, group_id, installment_number, amount, scheduled_date,
           status, paid_at, invoice_id, notes, title, category_id, beneficiary_id,
           source_wallet_id, destination_wallet_id, credit_card_id, created_at
      from jsonb_to_recordset(coalesce(payload -> 'transactions', '[]'::jsonb)) as rows(
        id text, group_id text, installment_number integer, amount numeric,
        scheduled_date date, status text, paid_at timestamptz, invoice_id text,
        notes text, title text, category_id text, beneficiary_id text,
        source_wallet_id text, destination_wallet_id text, credit_card_id text,
        created_at timestamptz
      )
    on conflict (user_id, id) do update set
        group_id = excluded.group_id,
        installment_number = excluded.installment_number,
        amount = excluded.amount,
        scheduled_date = excluded.scheduled_date,
        status = excluded.status,
        paid_at = excluded.paid_at,
        invoice_id = excluded.invoice_id,
        notes = excluded.notes,
        title = excluded.title,
        category_id = excluded.category_id,
        beneficiary_id = excluded.beneficiary_id,
        source_wallet_id = excluded.source_wallet_id,
        destination_wallet_id = excluded.destination_wallet_id,
        credit_card_id = excluded.credit_card_id,
        created_at = excluded.created_at;

    insert into public.ledger_entries (
        user_id, id, wallet_id, transaction_id, invoice_id, amount,
        balance_after, description, created_at
    )
    select v_user_id, id, wallet_id, transaction_id, invoice_id, amount,
           balance_after, description, created_at
      from jsonb_to_recordset(coalesce(payload -> 'ledger_entries', '[]'::jsonb)) as rows(
        id text, wallet_id text, transaction_id text, invoice_id text, amount numeric,
        balance_after numeric, description text, created_at timestamptz
      )
    on conflict (user_id, id) do update set
        wallet_id = excluded.wallet_id,
        transaction_id = excluded.transaction_id,
        invoice_id = excluded.invoice_id,
        amount = excluded.amount,
        balance_after = excluded.balance_after,
        description = excluded.description,
        created_at = excluded.created_at;

    delete from public.transaction_tags where user_id = v_user_id;

    insert into public.transaction_tags (user_id, transaction_id, tag_id)
    select v_user_id, transaction_id, tag_id
      from jsonb_to_recordset(coalesce(payload -> 'transaction_tags', '[]'::jsonb)) as rows(
        transaction_id text, tag_id text
      )
    on conflict (user_id, transaction_id, tag_id) do nothing;

    delete from public.ledger_entries
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'ledger_entries', '[]'::jsonb)) item
            where item ->> 'id' = ledger_entries.id
       );

    delete from public.transactions
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'transactions', '[]'::jsonb)) item
            where item ->> 'id' = transactions.id
       );

    delete from public.credit_card_invoices
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'credit_card_invoices', '[]'::jsonb)) item
            where item ->> 'id' = credit_card_invoices.id
       );

    delete from public.transaction_groups
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'transaction_groups', '[]'::jsonb)) item
            where item ->> 'id' = transaction_groups.id
       );

    delete from public.wish_items
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'wish_items', '[]'::jsonb)) item
            where item ->> 'id' = wish_items.id
       );

    delete from public.tags
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'tags', '[]'::jsonb)) item
            where item ->> 'id' = tags.id
       );

    delete from public.categories
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'categories', '[]'::jsonb)) item
            where item ->> 'id' = categories.id
       );

    delete from public.beneficiaries
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'beneficiaries', '[]'::jsonb)) item
            where item ->> 'id' = beneficiaries.id
       );

    delete from public.credit_cards
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'credit_cards', '[]'::jsonb)) item
            where item ->> 'id' = credit_cards.id
       );

    delete from public.wallets
     where user_id = v_user_id
       and not exists (
           select 1 from jsonb_array_elements(coalesce(payload -> 'wallets', '[]'::jsonb)) item
            where item ->> 'id' = wallets.id
       );

    v_next_revision := v_current_revision + 1;

    update public.finance_sync_state
       set revision = v_next_revision,
           updated_at = now(),
           updated_by = client_id
     where user_id = v_user_id;

    return v_next_revision;
end;
$$;
