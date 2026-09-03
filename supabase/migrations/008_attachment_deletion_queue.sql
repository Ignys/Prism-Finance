-- Database cascades cannot call the Storage HTTP API. Preserve every deleted
-- object path in a durable queue so the client/worker can remove the blob after
-- the financial transaction commits.

create table if not exists public.attachment_deletion_queue (
    user_id uuid not null references auth.users(id) on delete cascade,
    bucket_id text not null default 'transaction-attachments',
    storage_path text not null,
    queued_at timestamptz not null default now(),
    attempts integer not null default 0 check (attempts >= 0),
    last_error text,
    primary key (user_id, bucket_id, storage_path)
);

alter table public.attachment_deletion_queue enable row level security;

drop policy if exists "attachment-deletion-queue-own-read" on public.attachment_deletion_queue;
create policy "attachment-deletion-queue-own-read" on public.attachment_deletion_queue
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "attachment-deletion-queue-own-delete" on public.attachment_deletion_queue;
create policy "attachment-deletion-queue-own-delete" on public.attachment_deletion_queue
    for delete to authenticated using (user_id = auth.uid());

drop policy if exists "attachment-deletion-queue-own-update" on public.attachment_deletion_queue;
create policy "attachment-deletion-queue-own-update" on public.attachment_deletion_queue
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists attachment_deletion_queue_user_queued_idx
    on public.attachment_deletion_queue(user_id, queued_at);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'transaction_attachments_owner_path_check') then
        alter table public.transaction_attachments
            add constraint transaction_attachments_owner_path_check
            check (storage_path like user_id::text || '/%') not valid;
    end if;
end;
$$;

create or replace function public.queue_deleted_transaction_attachment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.attachment_deletion_queue(user_id, bucket_id, storage_path)
    values (old.user_id, 'transaction-attachments', old.storage_path)
    on conflict (user_id, bucket_id, storage_path) do update
        set queued_at = least(attachment_deletion_queue.queued_at, excluded.queued_at);
    return old;
end;
$$;

drop trigger if exists transaction_attachments_queue_blob_delete on public.transaction_attachments;
create trigger transaction_attachments_queue_blob_delete
before delete on public.transaction_attachments
for each row execute function public.queue_deleted_transaction_attachment();

revoke all on function public.queue_deleted_transaction_attachment() from public;
revoke insert on public.attachment_deletion_queue from anon, authenticated;
grant select, update, delete on public.attachment_deletion_queue to authenticated;
