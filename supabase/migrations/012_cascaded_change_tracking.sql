-- Cascades and SET NULL actions are database mutations too. Stamp indirectly
-- updated rows and emit tombstones for every deleted entity so incremental
-- clients observe the same dependency graph as a full atomic snapshot.

create or replace function public.stamp_finance_row_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    active_revision bigint;
begin
    active_revision := nullif(current_setting('prism.finance_revision', true), '')::bigint;

    new.updated_at := now();
    new.version := greatest(new.version, coalesce(active_revision, 0));
    return new;
end;
$$;

create or replace function public.record_finance_row_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    entity_kind text;
    entity_key text;
    related_key text := '';
    active_revision bigint;
    active_client_id text;
begin
    active_revision := nullif(current_setting('prism.finance_revision', true), '')::bigint;
    active_client_id := nullif(current_setting('prism.finance_client_id', true), '');

    -- Deletes outside a versioned user commit are recovered through the
    -- incremental loader's revision-gap/full-snapshot fallback.
    if coalesce(active_revision, 0) < 1 then
        return old;
    end if;

    entity_kind := case tg_table_name
        when 'wallets' then 'wallet'
        when 'credit_cards' then 'credit_card'
        when 'beneficiaries' then 'beneficiary'
        when 'categories' then 'category'
        when 'tags' then 'tag'
        when 'wish_items' then 'wish_item'
        when 'transaction_groups' then 'transaction_group'
        when 'credit_card_invoices' then 'credit_card_invoice'
        when 'transactions' then 'transaction'
        when 'ledger_entries' then 'ledger_entry'
        when 'transaction_tags' then 'transaction_tag'
        else null
    end;

    if entity_kind = 'transaction_tag' then
        entity_key := old.transaction_id;
        related_key := old.tag_id;
    else
        entity_key := old.id;
    end if;

    if entity_kind is not null and entity_key is not null then
        insert into public.finance_tombstones(
            user_id, entity_type, entity_id, related_id, version, deleted_at, deleted_by
        ) values (
            old.user_id, entity_kind, entity_key, coalesce(related_key, ''),
            active_revision, now(), active_client_id
        )
        on conflict (user_id, entity_type, entity_id, related_id) do update set
            version = excluded.version,
            deleted_at = excluded.deleted_at,
            deleted_by = excluded.deleted_by;
    end if;
    return old;
end;
$$;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'finance_preferences', 'wallets', 'credit_cards', 'beneficiaries', 'categories', 'tags',
        'wish_items', 'transaction_groups', 'credit_card_invoices',
        'transactions', 'ledger_entries', 'transaction_tags'
    ] loop
        execute format('drop trigger if exists %I on public.%I', table_name || '_stamp_version', table_name);
        execute format(
            'create trigger %I before update on public.%I for each row execute function public.stamp_finance_row_version()',
            table_name || '_stamp_version',
            table_name
        );

        if table_name <> 'finance_preferences' then
            execute format('drop trigger if exists %I on public.%I', table_name || '_record_tombstone', table_name);
            execute format(
                'create trigger %I after delete on public.%I for each row execute function public.record_finance_row_tombstone()',
                table_name || '_record_tombstone',
                table_name
            );
        end if;
    end loop;
end;
$$;

revoke all on function public.stamp_finance_row_version() from public;
revoke all on function public.record_finance_row_tombstone() from public;
