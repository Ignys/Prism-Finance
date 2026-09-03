-- Supabase installs pgcrypto in the `extensions` schema. The security-definer
-- functions below were originally restricted to `public, pg_temp`, so their
-- unqualified pgcrypto calls failed at runtime even though the extension was
-- installed. Discover the real extension schema to also support local/staging
-- databases where pgcrypto may live in `public`.
do $$
declare
    pgcrypto_schema text;
begin
    select n.nspname
      into pgcrypto_schema
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pgcrypto';

    if pgcrypto_schema is null then
        raise exception 'PGCRYPTO_EXTENSION_REQUIRED' using errcode = '55000';
    end if;

    if to_regprocedure('public.create_family_invite(uuid,integer)') is not null then
        execute format(
            'alter function public.create_family_invite(uuid, integer) set search_path = public, %I, pg_temp',
            pgcrypto_schema
        );
    end if;

    if to_regprocedure('public.apply_finance_changes_rowwise(bigint,jsonb,text)') is not null then
        execute format(
            'alter function public.apply_finance_changes_rowwise(bigint, jsonb, text) set search_path = public, %I, pg_temp',
            pgcrypto_schema
        );
    end if;

    -- Keep this migration safe on databases where 015 has not renamed the
    -- original implementation yet.
    if to_regprocedure('public.apply_finance_changes(bigint,jsonb,text)') is not null
       and to_regprocedure('public.apply_finance_changes_rowwise(bigint,jsonb,text)') is null then
        execute format(
            'alter function public.apply_finance_changes(bigint, jsonb, text) set search_path = public, %I, pg_temp',
            pgcrypto_schema
        );
    end if;
end;
$$;

notify pgrst, 'reload schema';
