-- Publish only a monotonically increasing family-share revision. Members then
-- reload the narrow get_current_family_context projection; personal finance
-- rows remain private and are never exposed through Realtime.

create table if not exists public.family_share_sync_state (
    family_id uuid primary key references public.families(id) on delete cascade,
    revision bigint not null default 0 check (revision >= 0),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

alter table public.family_share_sync_state enable row level security;
drop policy if exists "family-share-sync-active-member-read" on public.family_share_sync_state;
create policy "family-share-sync-active-member-read" on public.family_share_sync_state
    for select to authenticated using (public.is_family_member(family_id));

revoke insert, update, delete on public.family_share_sync_state from anon, authenticated;
grant select on public.family_share_sync_state to authenticated;

create or replace function public.bump_family_share_revision(target_family_id uuid, actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if target_family_id is null or not exists (select 1 from public.families where id = target_family_id) then
        return;
    end if;

    insert into public.family_share_sync_state(family_id, revision, updated_at, updated_by)
    values (target_family_id, 1, now(), actor_user_id)
    on conflict (family_id) do update set
        revision = family_share_sync_state.revision + 1,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

create or replace function public.bump_family_share_from_wishlist()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    owner_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    target_family_id uuid;
begin
    select fm.family_id into target_family_id
      from public.family_members fm
     where fm.user_id = owner_user_id and fm.status = 'active'
     limit 1;
    perform public.bump_family_share_revision(target_family_id, owner_user_id);
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists wish_items_bump_family_share on public.wish_items;
create trigger wish_items_bump_family_share
after insert or update or delete on public.wish_items
for each row execute function public.bump_family_share_from_wishlist();

create or replace function public.bump_family_share_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    target_family_id uuid := case when tg_op = 'DELETE' then old.family_id else new.family_id end;
    actor_user_id uuid := coalesce(auth.uid(), case when tg_op = 'DELETE' then old.user_id else new.user_id end);
begin
    perform public.bump_family_share_revision(target_family_id, actor_user_id);
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists family_members_bump_family_share on public.family_members;
create trigger family_members_bump_family_share
after insert or update of status, display_name or delete on public.family_members
for each row execute function public.bump_family_share_from_membership();

insert into public.family_share_sync_state(family_id, revision, updated_at)
select f.id, 1, now() from public.families f
on conflict (family_id) do nothing;

do $$
begin
    alter publication supabase_realtime add table public.family_share_sync_state;
exception
    when duplicate_object then null;
    when undefined_object then null;
end $$;

revoke all on function public.bump_family_share_revision(uuid, uuid) from public;
revoke all on function public.bump_family_share_from_wishlist() from public;
revoke all on function public.bump_family_share_from_membership() from public;
