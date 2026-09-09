alter table public.transactions add column routing_override boolean not null default false;

create or replace function public.resolve_transaction_routing(row_value text, group_value text, is_override boolean)
returns text language sql immutable parallel safe as $$
    select case when is_override then row_value else coalesce(row_value, group_value) end;
$$;
revoke all on function public.resolve_transaction_routing(text,text,boolean) from public;
grant execute on function public.resolve_transaction_routing(text,text,boolean) to authenticated;

do $$ declare definition text; revised text; target record; prefix text; expression text;
begin
    definition := pg_get_functiondef('public.apply_finance_changes_rowwise(bigint,jsonb,text)'::regprocedure);
    if position('occurrence_number, commitment, amount' in definition)=0 then raise exception 'Unexpected finance routing writer shape'; end if;
    definition := replace(definition, 'occurrence_number, commitment, amount', 'occurrence_number, routing_override, commitment, amount');
    definition := replace(definition, 'occurrence_number, coalesce(r.commitment',
        'occurrence_number, coalesce(r.routing_override, (select t.routing_override from public.transactions t where t.user_id=current_user_id and t.id=r.id), false), coalesce(r.commitment');
    definition := replace(definition, 'occurrence_number integer, commitment text', 'occurrence_number integer, routing_override boolean, commitment text');
    definition := replace(definition, 'commitment = excluded.commitment', 'routing_override = excluded.routing_override, commitment = excluded.commitment');
    execute definition;

    for target in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prokind='f'
    loop
        definition := pg_get_functiondef(target.oid);
        revised := regexp_replace(definition,
            'coalesce\((t|new|old|old_row)\.(source_wallet_id|destination_wallet_id|credit_card_id),\s*g\.\2\)',
            'public.resolve_transaction_routing(\1.\2, g.\2, \1.routing_override)', 'gi');
        foreach prefix in array array['new','old_row'] loop
            expression := 'coalesce(' || prefix || '.credit_card_id, (select g.credit_card_id from public.transaction_groups g where g.user_id=' || prefix || '.user_id and g.id=' || prefix || '.group_id))';
            revised := replace(revised, expression, '(case when ' || prefix || '.routing_override then ' || prefix || '.credit_card_id else ' || expression || ' end)');
        end loop;
        revised := replace(revised, 'where n.commitment is distinct from o.commitment', 'where n.routing_override is distinct from o.routing_override or n.commitment is distinct from o.commitment');
        if revised is distinct from definition then execute revised; end if;
    end loop;

    -- Keep existing view column order; adding the new stored column is unnecessary.
    definition := pg_get_viewdef('public.effective_transactions'::regclass, true);
    revised := regexp_replace(definition,
        'coalesce\(t\.(source_wallet_id|destination_wallet_id|credit_card_id),\s*g\.\1\)',
        'public.resolve_transaction_routing(t.\1, g.\1, t.routing_override)', 'gi');
    execute 'create or replace view public.effective_transactions with (security_invoker=true) as ' || revised;
end; $$;
notify pgrst, 'reload schema';
