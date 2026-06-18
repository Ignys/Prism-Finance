alter table public.transactions
    add column if not exists title text,
    add column if not exists category_id text,
    add column if not exists beneficiary_id text,
    add column if not exists source_wallet_id text,
    add column if not exists destination_wallet_id text,
    add column if not exists credit_card_id text;

alter table public.transactions
    add constraint transactions_category_override_fk
        foreign key (user_id, category_id) references public.categories(user_id, id) on delete set null;

alter table public.transactions
    add constraint transactions_beneficiary_override_fk
        foreign key (user_id, beneficiary_id) references public.beneficiaries(user_id, id) on delete set null;

alter table public.transactions
    add constraint transactions_source_wallet_override_fk
        foreign key (user_id, source_wallet_id) references public.wallets(user_id, id) on delete set null;

alter table public.transactions
    add constraint transactions_destination_wallet_override_fk
        foreign key (user_id, destination_wallet_id) references public.wallets(user_id, id) on delete set null;

alter table public.transactions
    add constraint transactions_credit_card_override_fk
        foreign key (user_id, credit_card_id) references public.credit_cards(user_id, id) on delete set null;
