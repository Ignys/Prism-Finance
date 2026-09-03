create table if not exists public.transaction_details (
    user_id uuid not null references auth.users(id) on delete cascade,
    transaction_id text not null,
    annotation text,
    updated_at timestamptz not null default now(),
    primary key (user_id, transaction_id),
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade
);

create table if not exists public.transaction_attachments (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    transaction_id text not null,
    file_name text not null,
    storage_path text not null,
    mime_type text,
    size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
    created_at timestamptz not null default now(),
    primary key (user_id, id),
    unique (storage_path),
    foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade
);

create index if not exists transaction_attachments_user_transaction_idx
    on public.transaction_attachments(user_id, transaction_id, created_at);

alter table public.transaction_details enable row level security;
alter table public.transaction_attachments enable row level security;

drop policy if exists "transaction-details-own-all" on public.transaction_details;
create policy "transaction-details-own-all" on public.transaction_details
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "transaction-attachments-own-all" on public.transaction_attachments;
create policy "transaction-attachments-own-all" on public.transaction_attachments
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('transaction-attachments', 'transaction-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "transaction-attachment-files-select" on storage.objects;
create policy "transaction-attachment-files-select" on storage.objects
    for select to authenticated
    using (bucket_id = 'transaction-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "transaction-attachment-files-insert" on storage.objects;
create policy "transaction-attachment-files-insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'transaction-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "transaction-attachment-files-delete" on storage.objects;
create policy "transaction-attachment-files-delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'transaction-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
