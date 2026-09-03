-- Family membership is managed exclusively through audited RPCs. Authenticated
-- clients can read their family, but cannot insert/update their own membership.

alter table public.family_invites
    add column if not exists expires_at timestamptz,
    add column if not exists accepted_at timestamptz,
    add column if not exists cancelled_at timestamptz;

alter table public.families
    add column if not exists max_members integer not null default 6 check (max_members between 2 and 50);

update public.family_invites
   set expires_at = created_at + interval '7 days'
 where expires_at is null;

alter table public.family_invites
    alter column expires_at set default (now() + interval '7 days'),
    alter column expires_at set not null;

insert into public.family_members (family_id, user_id, display_name, email, role, status, joined_at)
select f.id,
       f.owner_user_id,
       coalesce(nullif(p.display_name, ''), 'Usuario'),
       p.email,
       'admin',
       'active',
       f.created_at
  from public.families f
  left join public.profiles p on p.id = f.owner_user_id
 where not exists (
       select 1
         from public.family_members fm
        where fm.family_id = f.id
          and fm.user_id = f.owner_user_id
   )
on conflict (family_id, user_id) do nothing;

update public.family_members fm
   set role = 'admin', status = 'active'
  from public.families f
 where f.id = fm.family_id
   and f.owner_user_id = fm.user_id
   and (fm.role <> 'admin' or fm.status <> 'active');

create unique index if not exists family_members_one_active_family_per_user_idx
    on public.family_members(user_id)
    where status = 'active';

create index if not exists family_members_family_status_idx
    on public.family_members(family_id, status, joined_at);

create index if not exists family_invites_family_status_expires_idx
    on public.family_invites(family_id, status, expires_at);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.uid() is not null and exists (
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
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.uid() is not null and exists (
        select 1
          from public.family_members
         where family_id = target_family_id
           and user_id = auth.uid()
           and role = 'admin'
           and status = 'active'
    );
$$;

create or replace function public.refresh_family_member_count(target_family_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
    update public.families
       set member_count = (
               select count(*)::integer
                 from public.family_members
                where family_id = target_family_id
                  and status = 'active'
           ),
           updated_at = now()
     where id = target_family_id;
$$;

create or replace function public.sync_family_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op <> 'INSERT' then
        perform public.refresh_family_member_count(old.family_id);
    end if;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or old.family_id is distinct from new.family_id) then
        perform public.refresh_family_member_count(new.family_id);
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists family_members_sync_count on public.family_members;
create trigger family_members_sync_count
after insert or update of family_id, status or delete on public.family_members
for each row execute function public.sync_family_member_count();

create or replace function public.assert_family_owner_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    target_family_id uuid;
begin
    if tg_table_name = 'families' then
        target_family_id := case when tg_op = 'DELETE' then old.id else new.id end;
    else
        target_family_id := case when tg_op = 'DELETE' then old.family_id else new.family_id end;
    end if;

    if exists (select 1 from public.families where id = target_family_id)
       and not exists (
           select 1
             from public.families f
             join public.family_members fm
               on fm.family_id = f.id
              and fm.user_id = f.owner_user_id
              and fm.role = 'admin'
              and fm.status = 'active'
            where f.id = target_family_id
       ) then
        raise exception 'FAMILY_OWNER_MUST_BE_ACTIVE_ADMIN' using errcode = '23514';
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists families_owner_admin_guard on public.families;
create constraint trigger families_owner_admin_guard
after insert or update of owner_user_id on public.families
deferrable initially deferred
for each row execute function public.assert_family_owner_is_admin();

drop trigger if exists family_members_owner_admin_guard on public.family_members;
create constraint trigger family_members_owner_admin_guard
after insert or update or delete on public.family_members
deferrable initially deferred
for each row execute function public.assert_family_owner_is_admin();

drop policy if exists "families-member-read" on public.families;
drop policy if exists "families-owner-insert" on public.families;
drop policy if exists "families-admin-update" on public.families;
drop policy if exists "family-members-member-read" on public.family_members;
drop policy if exists "family-members-self-or-admin-write" on public.family_members;
drop policy if exists "family-invites-member-read" on public.family_invites;
drop policy if exists "family-invites-admin-write" on public.family_invites;

create policy "families-active-member-read" on public.families
    for select to authenticated
    using (public.is_family_member(id));

create policy "family-members-active-member-read" on public.family_members
    for select to authenticated
    using (
        public.is_family_member(family_id)
        and (status = 'active' or public.is_family_admin(family_id))
    );

create policy "family-invites-admin-read" on public.family_invites
    for select to authenticated
    using (public.is_family_admin(family_id));

revoke insert, update, delete on public.families from anon, authenticated;
revoke insert, update, delete on public.family_members from anon, authenticated;
revoke insert, update, delete on public.family_invites from anon, authenticated;

create or replace function public.create_family(family_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    current_user_id uuid := auth.uid();
    new_family_id uuid;
    member_name text;
    member_email text;
begin
    if current_user_id is null then
        raise exception 'FAMILY_AUTH_REQUIRED' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.family_members where user_id = current_user_id and status = 'active') then
        raise exception 'FAMILY_ALREADY_ACTIVE_MEMBER' using errcode = 'P0001';
    end if;

    select coalesce(nullif(display_name, ''), 'Usuario'), email
      into member_name, member_email
      from public.profiles
     where id = current_user_id;

    insert into public.families(name, owner_user_id, member_count)
    values (coalesce(nullif(btrim(family_name), ''), 'Minha familia'), current_user_id, 1)
    returning id into new_family_id;

    insert into public.family_members(family_id, user_id, display_name, email, role, status)
    values (new_family_id, current_user_id, coalesce(member_name, 'Usuario'), member_email, 'admin', 'active');

    return new_family_id;
end;
$$;

create or replace function public.create_family_invite(target_family_id uuid, ttl_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    current_user_id uuid := auth.uid();
    invite_id text := gen_random_uuid()::text;
    invite_code text := upper(encode(gen_random_bytes(10), 'hex'));
    invite_expiration timestamptz;
begin
    if current_user_id is null or not public.is_family_admin(target_family_id) then
        raise exception 'FAMILY_ADMIN_REQUIRED' using errcode = '42501';
    end if;
    if ttl_hours < 1 or ttl_hours > 720 then
        raise exception 'FAMILY_INVITE_TTL_INVALID' using errcode = '22023';
    end if;

    invite_expiration := now() + make_interval(hours => ttl_hours);
    insert into public.family_invites(family_id, id, code, created_by, status, expires_at)
    values (target_family_id, invite_id, invite_code, current_user_id, 'pending', invite_expiration);

    return jsonb_build_object(
        'invite_id', invite_id,
        'code', invite_code,
        'expires_at', invite_expiration
    );
end;
$$;

create or replace function public.accept_family_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    current_user_id uuid := auth.uid();
    target_invite public.family_invites%rowtype;
    member_name text;
    member_email text;
    family_limit integer;
begin
    if current_user_id is null then
        raise exception 'FAMILY_AUTH_REQUIRED' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.family_members where user_id = current_user_id and status = 'active') then
        raise exception 'FAMILY_ALREADY_ACTIVE_MEMBER' using errcode = 'P0001';
    end if;

    select * into target_invite
      from public.family_invites
     where code = upper(btrim(invite_code))
       and status = 'pending'
       and expires_at > now()
     for update;

    if not found then
        raise exception 'FAMILY_INVITE_INVALID_OR_EXPIRED' using errcode = 'P0001';
    end if;
    if target_invite.created_by = current_user_id then
        raise exception 'FAMILY_INVITE_SELF_ACCEPT_FORBIDDEN' using errcode = 'P0001';
    end if;

    select max_members into family_limit
      from public.families
     where id = target_invite.family_id
     for update;
    if (select count(*) from public.family_members where family_id = target_invite.family_id and status = 'active') >= family_limit then
        raise exception 'FAMILY_MEMBER_LIMIT_REACHED' using errcode = 'P0001';
    end if;

    select coalesce(nullif(display_name, ''), 'Usuario'), email
      into member_name, member_email
      from public.profiles
     where id = current_user_id;

    insert into public.family_members(family_id, user_id, display_name, email, role, status)
    values (target_invite.family_id, current_user_id, coalesce(member_name, 'Usuario'), member_email, 'member', 'active')
    on conflict (family_id, user_id) do update
        set display_name = excluded.display_name,
            email = excluded.email,
            role = 'member',
            status = 'active',
            joined_at = now();

    update public.family_invites
       set status = 'accepted', accepted_by = current_user_id, accepted_at = now()
     where family_id = target_invite.family_id and id = target_invite.id;

    return target_invite.family_id;
end;
$$;

create or replace function public.cancel_family_invite(target_family_id uuid, target_invite_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.uid() is null or not public.is_family_admin(target_family_id) then
        raise exception 'FAMILY_ADMIN_REQUIRED' using errcode = '42501';
    end if;
    update public.family_invites
       set status = 'cancelled', cancelled_at = now()
     where family_id = target_family_id and id = target_invite_id and status = 'pending';
end;
$$;

create or replace function public.remove_family_member(target_family_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    owner_id uuid;
begin
    if auth.uid() is null then
        raise exception 'FAMILY_AUTH_REQUIRED' using errcode = 'P0001';
    end if;
    select owner_user_id into owner_id from public.families where id = target_family_id for update;
    if owner_id is null then
        raise exception 'FAMILY_NOT_FOUND' using errcode = 'P0001';
    end if;
    if target_user_id = owner_id then
        raise exception 'FAMILY_OWNER_CANNOT_BE_REMOVED' using errcode = 'P0001';
    end if;
    if auth.uid() <> target_user_id and not public.is_family_admin(target_family_id) then
        raise exception 'FAMILY_ADMIN_REQUIRED' using errcode = '42501';
    end if;

    delete from public.family_members
     where family_id = target_family_id and user_id = target_user_id;
end;
$$;

create or replace function public.get_current_family()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with membership as (
        select fm.family_id, fm.role
          from public.family_members fm
         where fm.user_id = auth.uid() and fm.status = 'active'
         limit 1
    )
    select jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'owner_user_id', f.owner_user_id,
        'member_count', f.member_count,
        'max_members', f.max_members,
        'current_user_role', m.role,
        'members', coalesce((
            select jsonb_agg(to_jsonb(fm) order by fm.joined_at, fm.user_id)
              from public.family_members fm
             where fm.family_id = f.id
               and (fm.status = 'active' or m.role = 'admin')
        ), '[]'::jsonb),
        'invites', case when m.role = 'admin' then coalesce((
            select jsonb_agg(to_jsonb(fi) order by fi.created_at desc)
              from public.family_invites fi
             where fi.family_id = f.id
               and fi.status = 'pending'
               and fi.expires_at > now()
        ), '[]'::jsonb) else '[]'::jsonb end
    )
      from membership m
      join public.families f on f.id = m.family_id;
$$;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.is_family_admin(uuid) from public;
revoke all on function public.refresh_family_member_count(uuid) from public;
revoke all on function public.sync_family_member_count() from public;
revoke all on function public.assert_family_owner_is_admin() from public;
revoke all on function public.create_family(text) from public;
revoke all on function public.create_family_invite(uuid, integer) from public;
revoke all on function public.accept_family_invite(text) from public;
revoke all on function public.cancel_family_invite(uuid, text) from public;
revoke all on function public.remove_family_member(uuid, uuid) from public;
revoke all on function public.get_current_family() from public;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.create_family_invite(uuid, integer) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;
grant execute on function public.cancel_family_invite(uuid, text) to authenticated;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;
grant execute on function public.get_current_family() to authenticated;
