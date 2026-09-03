-- Family members may share wishlist fields without exposing wallets,
-- transactions, ledger rows, or any other personal finance table through RLS.

create or replace function public.get_current_family_context()
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
    ), current_family as (
        select f.*, m.role as current_user_role
          from membership m
          join public.families f on f.id = m.family_id
    )
    select jsonb_build_object(
        'family', jsonb_build_object(
            'id', f.id,
            'name', f.name,
            'owner_user_id', f.owner_user_id,
            'member_count', f.member_count,
            'max_members', f.max_members,
            'current_user_role', f.current_user_role,
            'members', coalesce((
                select jsonb_agg(to_jsonb(fm) order by fm.joined_at, fm.user_id)
                  from public.family_members fm
                 where fm.family_id = f.id
                   and (fm.status = 'active' or f.current_user_role = 'admin')
            ), '[]'::jsonb),
            'invites', case when f.current_user_role = 'admin' then coalesce((
                select jsonb_agg(to_jsonb(fi) order by fi.created_at desc)
                  from public.family_invites fi
                 where fi.family_id = f.id
                   and fi.status = 'pending'
                   and fi.expires_at > now()
            ), '[]'::jsonb) else '[]'::jsonb end
        ),
        'shared_wishlists', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'owner', jsonb_build_object(
                        'uid', fm.user_id,
                        'name', fm.display_name,
                        'is_current_user', fm.user_id = auth.uid()
                    ),
                    'items', coalesce((
                        select jsonb_agg(
                            jsonb_build_object(
                                'id', wi.id,
                                'description', wi.description,
                                'value', wi.value,
                                'priority', wi.priority,
                                'link', wi.link,
                                'image_url', wi.image_url,
                                'created_at', wi.created_at,
                                'is_active', wi.is_active,
                                'category_label', coalesce(c.name, 'Categoria removida'),
                                'category_icon', coalesce(c.icon, ''),
                                'category_color', c.color
                            ) order by wi.created_at desc, wi.id
                        )
                          from public.wish_items wi
                          left join public.categories c
                            on c.user_id = wi.user_id and c.id = wi.category_id
                         where wi.user_id = fm.user_id and wi.is_active
                    ), '[]'::jsonb),
                    'updated_at', coalesce((
                        select max(wi.updated_at)
                          from public.wish_items wi
                         where wi.user_id = fm.user_id and wi.is_active
                    ), fm.joined_at)
                ) order by fm.joined_at, fm.user_id
            )
              from public.family_members fm
             where fm.family_id = f.id and fm.status = 'active'
        ), '[]'::jsonb)
    )
      from current_family f;
$$;

revoke all on function public.get_current_family_context() from public;
grant execute on function public.get_current_family_context() to authenticated;
