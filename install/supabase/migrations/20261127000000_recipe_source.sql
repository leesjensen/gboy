-- Where a recipe came from ("Good Housekeeping, Jan/Feb 2020, p. 110"),
-- moved out of titles written as "Dish (from Source)". A note after the
-- credit stays in the title: "Cake (from blendtec.com) - DIVINE" becomes
-- title "Cake - DIVINE", source "blendtec.com". Recipe IDs don't change.
-- scripts/build_recipe_data.py (split_source) applies the same rule.

alter table public.recipes
  add column source text not null default '';

update public.recipes r
set
  title = concat_ws(' ', nullif(btrim(m[1]), ''), nullif(btrim(m[3]), '')),
  source = btrim(m[2])
from (
  select id, regexp_match(title, '^(.*?)\s*\(\s*from\s+([^()]*)\)\s*(.*)$', 'i') as m
  from public.recipes
) parts
where r.id = parts.id
  and parts.m is not null
  and btrim(parts.m[1]) <> '';

-- Keep sources searchable now that they're out of the title.
alter table public.recipes
  alter column search set expression as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subcategory, '') || ' ' || coalesce(source, '')), 'B') ||
    setweight(to_tsvector('english', jsonb_path_query_array(blocks, '$[*].text')::text), 'C')
  );
