-- JSON routing and tag defaults must obey the same owner boundary as row FKs.
create or replace function public.assert_recurrence_registry_references()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid; target record; field_name text; reference_id text;
begin
    owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    for target in select g.recurrence_rule as rule from public.transaction_groups g
        where g.user_id = owner_id and g.transaction_mode = 'recurring'
          and (tg_table_name <> 'transaction_groups' or g.id = new.id)
    loop
        foreach field_name in array array['sourceWalletId', 'destinationWalletId', 'creditCardId'] loop
            reference_id := target.rule ->> field_name;
            if reference_id is null then continue; end if;
            if jsonb_typeof(target.rule -> field_name) <> 'string' or
               (field_name = 'creditCardId' and not exists(select 1 from public.credit_cards c where c.user_id=owner_id and c.id=reference_id)) or
               (field_name <> 'creditCardId' and not exists(select 1 from public.wallets w where w.user_id=owner_id and w.id=reference_id))
            then raise exception 'RECURRENCE_ROUTING_REFERENCE_INVALID' using errcode = '23503'; end if;
        end loop;
        if exists(select 1 from jsonb_array_elements_text(coalesce(target.rule -> 'tagIds','[]'::jsonb)) t(id)
            where not exists(select 1 from public.tags tag where tag.user_id=owner_id and tag.id=t.id))
        then raise exception 'RECURRENCE_TAG_REFERENCE_INVALID' using errcode = '23503'; end if;
    end loop;
    return null;
end;
$$;

-- Legacy JSON may retain deleted defaults. Remove only dangling references;
-- existing transaction rows, overrides, annotations and financial history stay intact.
do $$ declare target record; repaired jsonb; field_name text; reference_id text;
begin
    for target in select user_id, id, recurrence_rule from public.transaction_groups where transaction_mode='recurring' loop
        repaired := target.recurrence_rule;
        foreach field_name in array array['sourceWalletId', 'destinationWalletId', 'creditCardId'] loop
            reference_id := repaired ->> field_name;
            if reference_id is not null and (
                (field_name='creditCardId' and not exists(select 1 from public.credit_cards c where c.user_id=target.user_id and c.id=reference_id)) or
                (field_name<>'creditCardId' and not exists(select 1 from public.wallets w where w.user_id=target.user_id and w.id=reference_id)))
            then repaired := repaired - field_name; end if;
        end loop;
        repaired := jsonb_set(repaired, '{tagIds}', coalesce((select jsonb_agg(t.id) from jsonb_array_elements_text(coalesce(repaired -> 'tagIds','[]'::jsonb)) t(id)
            where exists(select 1 from public.tags tag where tag.user_id=target.user_id and tag.id=t.id)), '[]'::jsonb));
        if repaired is distinct from target.recurrence_rule then
            update public.transaction_groups set recurrence_rule=repaired where user_id=target.user_id and id=target.id;
        end if;
    end loop;
end; $$;

create constraint trigger transaction_groups_recurrence_references after insert or update on public.transaction_groups
    deferrable initially deferred for each row execute function public.assert_recurrence_registry_references();
create constraint trigger wallets_recurrence_references after delete on public.wallets
    deferrable initially deferred for each row execute function public.assert_recurrence_registry_references();
create constraint trigger credit_cards_recurrence_references after delete on public.credit_cards
    deferrable initially deferred for each row execute function public.assert_recurrence_registry_references();
create constraint trigger tags_recurrence_references after delete on public.tags
    deferrable initially deferred for each row execute function public.assert_recurrence_registry_references();
revoke all on function public.assert_recurrence_registry_references() from public;
