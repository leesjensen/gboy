-- Anyone (signed in or not) may read categories and recipes.

alter table public.categories enable row level security;
alter table public.recipes    enable row level security;

-- Supabase grants everything (including TRUNCATE, which bypasses RLS) by
-- default; start from nothing and grant only what the policies cover.
revoke all on public.categories, public.recipes from anon, authenticated;
grant select on public.categories, public.recipes to anon, authenticated;

create policy "Public can read categories"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Public can read recipes"
  on public.recipes for select
  to anon, authenticated
  using (true);
