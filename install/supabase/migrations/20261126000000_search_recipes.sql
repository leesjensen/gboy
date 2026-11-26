-- Ranked recipe search over recipes.search (title A, subcategory B, text C).
-- Every word in the query must match, and each word also matches as a
-- prefix, so results update while someone types ("choc chip" finds
-- "chocolate chip"). Common words such as "the" are ignored.
-- `match` is the first recipe line containing the words, to show why a
-- recipe matched when its title doesn't.
--   supabase.rpc('search_recipes', { p_query: 'zucchini bread' })

create or replace function public.search_recipes(p_query text, p_limit integer default 50)
returns table (
  id text,
  title text,
  category_id text,
  subcategory text,
  source_page integer,
  match text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select to_tsquery('english', string_agg(word || ':*', ' & ')) as query
    from regexp_split_to_table(lower(left(coalesce(p_query, ''), 200)), '[^[:alnum:]]+') as word
    where word <> ''
  )
  select
    r.id,
    r.title,
    r.category_id,
    r.subcategory,
    r.source_page,
    (
      select b ->> 'text'
      from jsonb_array_elements(r.blocks) as b
      where to_tsvector('english', b ->> 'text') @@ q.query
      limit 1
    ) as match
  from public.recipes r, q
  where q.query is not null and r.search @@ q.query
  order by ts_rank(r.search, q.query) desc, r.title
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.search_recipes(text, integer) from public;
grant execute on function public.search_recipes(text, integer) to anon, authenticated;
