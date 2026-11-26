-- Write access is granted through public.roles (actor / object / predicate).
-- A row's object is '<type>/<id>' (recipe/<id>, category/<id>); a grant
-- matches it when the grant's object is '*', '<type>/*', or the exact object.
-- With today's grants: '*' admins may write recipes and categories,
-- 'recipe/*' admins may write recipes. Everyone else is read-only.

alter table public.roles enable row level security;

-- SECURITY DEFINER so the check can read roles regardless of its RLS.
-- Exposed as RPC so the app can ask, e.g.:
--   supabase.rpc('has_role', { p_predicate: 'admin', p_object: 'recipe/*' })
create or replace function public.has_role(p_predicate text, p_object text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roles r
    where r.actor = (select auth.uid())
      and r.predicate = p_predicate
      and (
        r.object = '*'
        or r.object = p_object
        or r.object = split_part(p_object, '/', 1) || '/*'
      )
  );
$$;

revoke all on function public.has_role(text, text) from public;
grant execute on function public.has_role(text, text) to anon, authenticated;

-- roles: signed-in users can see their own grants; '*' admins see all.
-- No insert/update/delete policies: manage grants with add_admin.sh.
revoke all on public.roles from anon, authenticated;
grant select on public.roles to authenticated;

create policy "Users can see own roles"
  on public.roles for select
  to authenticated
  using (actor = (select auth.uid()) or (select public.has_role('admin', '*')));

-- Write access for admins of each row's object.
grant insert, update, delete on public.categories, public.recipes to authenticated;

do $$
declare
  tbl text;
  obj text;
begin
  for tbl, obj in
    select * from (values ('categories', 'category'), ('recipes', 'recipe')) as v (tbl, obj)
  loop
    execute format($p$create policy "Admins can insert %1$s" on public.%1$I
      for insert to authenticated
      with check (public.has_role('admin', %2$L || '/' || id))$p$, tbl, obj);
    execute format($p$create policy "Admins can update %1$s" on public.%1$I
      for update to authenticated
      using (public.has_role('admin', %2$L || '/' || id))
      with check (public.has_role('admin', %2$L || '/' || id))$p$, tbl, obj);
    execute format($p$create policy "Admins can delete %1$s" on public.%1$I
      for delete to authenticated
      using (public.has_role('admin', %2$L || '/' || id))$p$, tbl, obj);
  end loop;
end;
$$;
