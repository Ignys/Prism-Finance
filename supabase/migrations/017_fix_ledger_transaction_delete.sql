-- The initial schema created unnamed composite ledger foreign keys with
-- ON DELETE SET NULL. Migration 006 added the intended CASCADE constraints,
-- but only dropped names that PostgreSQL did not assign to the original keys.
-- Some databases therefore kept both actions. A direct transaction deletion
-- could run SET NULL first and violate LEDGER_TRANSACTION_REQUIRED.

do $$
declare
    target record;
    constraint_name text;
begin
    for target in
        select * from (values
            ('transactions'::text, 'transaction_id'::text),
            ('credit_card_invoices'::text, 'invoice_id'::text)
        ) as targets(parent_table, reference_column)
    loop
        for constraint_name in
            select c.conname
              from pg_constraint c
             where c.conrelid = 'public.ledger_entries'::regclass
               and c.confrelid = format('public.%I', target.parent_table)::regclass
               and c.contype = 'f'
               and (
                   select array_agg(a.attname::text order by key_column.ordinality)
                     from unnest(c.conkey) with ordinality as key_column(attnum, ordinality)
                     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key_column.attnum
               ) = array['user_id', target.reference_column]
        loop
            execute format('alter table public.ledger_entries drop constraint %I', constraint_name);
        end loop;
    end loop;
end;
$$;

alter table public.ledger_entries add constraint ledger_entries_transaction_fk
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade;

alter table public.ledger_entries add constraint ledger_entries_invoice_fk
    foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id) on delete cascade;

