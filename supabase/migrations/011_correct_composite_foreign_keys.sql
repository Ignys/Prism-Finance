-- PostgreSQL SET NULL on a composite FK clears every referencing column unless
-- a column list is specified. The initial schema would therefore try to clear
-- the NOT NULL user_id. Recreate those constraints with explicit semantics.

do $$
declare
    target record;
    constraint_name text;
begin
    for target in
        select * from (values
            ('credit_cards', 'user_id,bank_wallet_id'),
            ('categories', 'user_id,parent_id'),
            ('transaction_groups', 'user_id,beneficiary_id'),
            ('transaction_groups', 'user_id,category_id'),
            ('transaction_groups', 'user_id,source_wallet_id'),
            ('transaction_groups', 'user_id,destination_wallet_id'),
            ('transaction_groups', 'user_id,credit_card_id'),
            ('transactions', 'user_id,invoice_id'),
            ('transactions', 'user_id,category_id'),
            ('transactions', 'user_id,beneficiary_id'),
            ('transactions', 'user_id,source_wallet_id'),
            ('transactions', 'user_id,destination_wallet_id'),
            ('transactions', 'user_id,credit_card_id')
        ) as targets(table_name, columns_csv)
    loop
        for constraint_name in
            select c.conname
              from pg_constraint c
             where c.conrelid = format('public.%I', target.table_name)::regclass
               and c.contype = 'f'
               and (
                   select array_agg(a.attname::text order by key_column.ordinality)
                     from unnest(c.conkey) with ordinality as key_column(attnum, ordinality)
                     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key_column.attnum
               ) = string_to_array(target.columns_csv, ',')
        loop
            execute format('alter table public.%I drop constraint %I', target.table_name, constraint_name);
        end loop;
    end loop;
end;
$$;

alter table public.credit_cards add constraint credit_cards_bank_wallet_fk
    foreign key (user_id, bank_wallet_id) references public.wallets(user_id, id)
    on delete set null (bank_wallet_id);

alter table public.categories add constraint categories_parent_fk
    foreign key (user_id, parent_id) references public.categories(user_id, id)
    on delete set null (parent_id);

alter table public.transaction_groups add constraint transaction_groups_beneficiary_fk
    foreign key (user_id, beneficiary_id) references public.beneficiaries(user_id, id)
    on delete set null (beneficiary_id);
alter table public.transaction_groups add constraint transaction_groups_category_fk
    foreign key (user_id, category_id) references public.categories(user_id, id)
    on delete set null (category_id);
alter table public.transaction_groups add constraint transaction_groups_source_wallet_fk
    foreign key (user_id, source_wallet_id) references public.wallets(user_id, id) on delete cascade;
alter table public.transaction_groups add constraint transaction_groups_destination_wallet_fk
    foreign key (user_id, destination_wallet_id) references public.wallets(user_id, id) on delete cascade;
alter table public.transaction_groups add constraint transaction_groups_credit_card_fk
    foreign key (user_id, credit_card_id) references public.credit_cards(user_id, id) on delete cascade;

alter table public.transactions add constraint transactions_invoice_fk
    foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id)
    on delete set null (invoice_id);
alter table public.transactions add constraint transactions_category_fk
    foreign key (user_id, category_id) references public.categories(user_id, id)
    on delete set null (category_id);
alter table public.transactions add constraint transactions_beneficiary_fk
    foreign key (user_id, beneficiary_id) references public.beneficiaries(user_id, id)
    on delete set null (beneficiary_id);
alter table public.transactions add constraint transactions_source_wallet_fk
    foreign key (user_id, source_wallet_id) references public.wallets(user_id, id) on delete cascade;
alter table public.transactions add constraint transactions_destination_wallet_fk
    foreign key (user_id, destination_wallet_id) references public.wallets(user_id, id) on delete cascade;
alter table public.transactions add constraint transactions_credit_card_fk
    foreign key (user_id, credit_card_id) references public.credit_cards(user_id, id) on delete cascade;
