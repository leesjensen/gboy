-- Category styling moves from src/App.jsx into the database so admins can add
-- and edit categories in the app (#/categories). Existing RLS already lets
-- '*' admins (has_role('admin', 'category/<id>')) insert, update and delete
-- categories; recipes.category_id still blocks deleting a category in use.

alter table public.categories
  add column icon text not null default '✦' check (char_length(icon) between 1 and 4),
  add column tint text not null default 'sage' check (tint in ('coral', 'gold', 'blue', 'sage', 'rose')),
  add column description text not null default '' check (char_length(description) <= 200),
  add constraint categories_name_not_blank check (char_length(btrim(name)) between 1 and 60);

update public.categories c
set icon = d.icon, tint = d.tint, description = d.description
from (values
  ('appetizers', '✳', 'coral', 'A little something to start the table and get everyone gathered around.'),
  ('backpacking', '⌁', 'gold', 'Trail-friendly favorites and camp cooking ideas from the collection.'),
  ('belgian', '✦', 'blue', 'A small collection of Belgian family recipes, from waffles to waterzooi.'),
  ('breads', '⌂', 'gold', 'Warm loaves, quick breads, rolls, muffins, and doughs worth sharing.'),
  ('breakfast', '☀', 'sage', 'Pancakes, oatmeal, brunch bakes, and easy starts to the day.'),
  ('desserts', '♡', 'rose', 'Cookies, cakes, pies, frozen treats, and a little something sweet.'),
  ('drinks', '◌', 'blue', 'Smoothies, coolers, punches, and cozy cups for every season.'),
  ('entrees', '✳', 'sage', 'Comforting mains, weeknight dinners, sandwiches, and wraps.'),
  ('salads', '❋', 'sage', 'Fresh greens, pasta salads, and colorful bowls for the middle of the table.'),
  ('sauces', '◉', 'coral', 'The dips, dressings, sauces, syrups, and spreads that make a meal sing.'),
  ('sides', '✿', 'gold', 'Vegetables, potatoes, grains, and all the good things alongside.'),
  ('soups', '◒', 'blue', 'A comforting pot for a chilly evening, a busy day, or a full table.')
) as d (id, icon, tint, description)
where c.id = d.id;

-- Reorders categories in one call: p_ids lists every category id in the new
-- order. Runs as the caller, so RLS limits it to category admins.
create function public.reorder_categories(p_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.categories c
  set sort_order = o.position - 1
  from unnest(p_ids) with ordinality as o (id, position)
  where c.id = o.id and c.sort_order is distinct from o.position - 1;
  -- RLS skips rows the caller can't change instead of failing; catch that.
  if exists (
    select 1 from public.categories c
    join unnest(p_ids) with ordinality as o (id, position) on o.id = c.id
    where c.sort_order is distinct from o.position - 1
  ) then
    raise exception 'Your account is not allowed to reorder categories.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.reorder_categories(text[]) from public, anon;
grant execute on function public.reorder_categories(text[]) to authenticated;
