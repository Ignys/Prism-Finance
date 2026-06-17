create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    firebase_uid text unique,
    display_name text not null default 'Usuario',
    email text,
    photo_url text,
    photo_public_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.finance_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    favorite_wallet_id text,
    favorite_credit_card_id text,
    planning jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    name text not null,
    icon text not null,
    type text not null check (type in ('checking', 'savings', 'cash', 'investment')),
    balance numeric(14, 2) not null default 0,
    initial_balance numeric(14, 2) not null default 0,
    currency text not null default 'BRL',
    color text not null,
    is_active boolean not null default true,
    include_in_main_totals boolean not null default true,
    created_at timestamptz not null,
    primary key (user_id, id)
);

create table if not exists public.credit_cards (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    name text not null,
    icon text not null,
    color text not null,
    credit_limit numeric(14, 2) not null default 0,
    closing_day integer not null check (closing_day between 1 and 31),
    due_day integer not null check (due_day between 1 and 31),
    bank_wallet_id text,
    is_active boolean not null default true,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, bank_wallet_id) references public.wallets(user_id, id) on delete set null
);

create table if not exists public.beneficiaries (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    family_id uuid,
    source text not null check (source in ('personal', 'family_shared')),
    is_self_profile boolean not null default false,
    name text not null,
    type text not null check (type in ('person', 'cost_center', 'pet', 'other')),
    avatar_color text,
    avatar_image text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null,
    primary key (user_id, id)
);

create table if not exists public.categories (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    parent_id text,
    name text not null,
    type text not null check (type in ('income', 'expense')),
    icon text not null,
    color text,
    is_active boolean not null default true,
    is_system boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, parent_id) references public.categories(user_id, id) on delete set null
);

create table if not exists public.tags (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    name text not null,
    color text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null,
    primary key (user_id, id)
);

create table if not exists public.wish_items (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    value numeric(14, 2) not null default 0,
    category_id text not null,
    priority text not null,
    description text not null,
    link text,
    image_url text,
    is_active boolean not null default true,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, category_id) references public.categories(user_id, id) on delete restrict
);

create table if not exists public.transaction_groups (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    beneficiary_id text,
    beneficiary_name text not null,
    category_id text,
    category_name text not null,
    subcategory_name text,
    title text not null,
    notes text,
    type text not null check (type in ('income', 'expense', 'transfer')),
    transaction_mode text not null check (transaction_mode in ('single', 'installment', 'recurring')),
    total_amount numeric(14, 2) not null default 0,
    installment_count integer,
    recurrence_rule jsonb,
    recurrence_end_date date,
    source_wallet_id text,
    destination_wallet_id text,
    credit_card_id text,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, beneficiary_id) references public.beneficiaries(user_id, id) on delete set null,
    foreign key (user_id, category_id) references public.categories(user_id, id) on delete set null,
    foreign key (user_id, source_wallet_id) references public.wallets(user_id, id) on delete set null,
    foreign key (user_id, destination_wallet_id) references public.wallets(user_id, id) on delete set null,
    foreign key (user_id, credit_card_id) references public.credit_cards(user_id, id) on delete set null
);

create table if not exists public.credit_card_invoices (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    credit_card_id text not null,
    cycle_key text not null,
    closing_date date not null,
    due_date date not null,
    total_amount numeric(14, 2) not null default 0,
    paid_amount numeric(14, 2) not null default 0,
    status text not null check (status in ('open', 'paid')),
    paid_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, credit_card_id) references public.credit_cards(user_id, id) on delete cascade
);

create table if not exists public.transactions (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    group_id text not null,
    installment_number integer,
    amount numeric(14, 2) not null default 0,
    scheduled_date date not null,
    status text not null check (status in ('pending', 'paid', 'cancelled', 'skipped')),
    paid_at timestamptz,
    invoice_id text,
    notes text,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, group_id) references public.transaction_groups(user_id, id) on delete cascade,
    foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id) on delete set null
);

create table if not exists public.ledger_entries (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    wallet_id text not null,
    transaction_id text,
    invoice_id text,
    amount numeric(14, 2) not null default 0,
    balance_after numeric(14, 2) not null default 0,
    description text not null,
    created_at timestamptz not null,
    primary key (user_id, id),
    foreign key (user_id, wallet_id) references public.wallets(user_id, id) on delete cascade,
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete set null,
    foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id) on delete set null
);

create table if not exists public.transaction_tags (
    user_id uuid not null references auth.users(id) on delete cascade,
    transaction_id text not null,
    tag_id text not null,
    primary key (user_id, transaction_id, tag_id),
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade,
    foreign key (user_id, tag_id) references public.tags(user_id, id) on delete cascade
);

create table if not exists public.families (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_user_id uuid not null references auth.users(id) on delete cascade,
    member_count integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
    family_id uuid not null references public.families(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    display_name text not null,
    email text,
    role text not null check (role in ('admin', 'member')),
    status text not null check (status in ('pending', 'active')),
    joined_at timestamptz not null default now(),
    primary key (family_id, user_id)
);

create table if not exists public.family_invites (
    family_id uuid not null references public.families(id) on delete cascade,
    id text not null,
    code text not null unique,
    created_by uuid not null references auth.users(id) on delete cascade,
    status text not null check (status in ('pending', 'accepted', 'cancelled')),
    accepted_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (family_id, id)
);

create index if not exists transaction_groups_user_created_at_idx on public.transaction_groups(user_id, created_at);
create index if not exists transactions_user_scheduled_date_idx on public.transactions(user_id, scheduled_date);
create index if not exists ledger_entries_user_created_at_idx on public.ledger_entries(user_id, created_at);
create index if not exists credit_card_invoices_user_due_date_idx on public.credit_card_invoices(user_id, due_date);

alter table public.profiles enable row level security;
alter table public.finance_preferences enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_cards enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.wish_items enable row level security;
alter table public.transaction_groups enable row level security;
alter table public.credit_card_invoices enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.family_members
        where family_id = target_family_id
          and user_id = auth.uid()
          and status = 'active'
    );
$$;

create or replace function public.is_family_admin(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.family_members
        where family_id = target_family_id
          and user_id = auth.uid()
          and role = 'admin'
          and status = 'active'
    );
$$;

create policy "profiles-own-all" on public.profiles
    for all using (id = auth.uid()) with check (id = auth.uid());

create policy "finance-preferences-own-all" on public.finance_preferences
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wallets-own-all" on public.wallets
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "credit-cards-own-all" on public.credit_cards
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "beneficiaries-own-all" on public.beneficiaries
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories-own-all" on public.categories
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tags-own-all" on public.tags
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wish-items-own-all" on public.wish_items
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transaction-groups-own-all" on public.transaction_groups
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "credit-card-invoices-own-all" on public.credit_card_invoices
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions-own-all" on public.transactions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ledger-entries-own-all" on public.ledger_entries
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transaction-tags-own-all" on public.transaction_tags
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "families-member-read" on public.families
    for select using (public.is_family_member(id));

create policy "families-owner-insert" on public.families
    for insert with check (owner_user_id = auth.uid());

create policy "families-admin-update" on public.families
    for update using (public.is_family_admin(id)) with check (public.is_family_admin(id));

create policy "family-members-member-read" on public.family_members
    for select using (public.is_family_member(family_id));

create policy "family-members-self-or-admin-write" on public.family_members
    for all using (user_id = auth.uid() or public.is_family_admin(family_id))
    with check (user_id = auth.uid() or public.is_family_admin(family_id));

create policy "family-invites-member-read" on public.family_invites
    for select using (public.is_family_member(family_id));

create policy "family-invites-admin-write" on public.family_invites
    for all using (public.is_family_admin(family_id)) with check (public.is_family_admin(family_id));
