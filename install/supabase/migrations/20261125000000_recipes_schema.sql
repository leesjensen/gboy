-- Recipe storage. Mirrors the shape of data/recipes.json.

create table public.categories (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.recipes (
  id               text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (length(trim(title)) > 0),
  category_id      text not null references public.categories (id) on update cascade,
  subcategory      text not null default '',
  source_page      integer check (source_page > 0),
  source_end_page  integer check (source_end_page > 0),
  -- [{ "type": "ingredient" | "step" | "note" | "label", "text": "..." }, ...]
  blocks           jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  source_text      text not null default '',
  -- Weighted full-text index, ready for the planned search feature.
  search           tsvector generated always as (
                     setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('english', coalesce(subcategory, '')), 'B') ||
                     setweight(to_tsvector('english', jsonb_path_query_array(blocks, '$[*].text')::text), 'C')
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null
);

create index recipes_category_idx on public.recipes (category_id, title);
create index recipes_search_idx on public.recipes using gin (search);

-- Role grants as actor / object / predicate triples:
--   actor      the auth user the grant applies to
--   object     what it applies to: '*' (everything), '<type>/*' (every
--              object of a type, e.g. 'recipe/*') or '<type>/<id>'
--   predicate  the relationship the actor has to the object, e.g. 'admin'
-- Currently grants are 'admin' on '*' or 'recipe/*'. Rows are managed by
-- install/supabase/add_admin.sh (no client write policies).
create table public.roles (
  id          bigint generated always as identity primary key,
  actor       uuid not null references auth.users (id) on delete cascade,
  object      text not null
                check (object ~ '^(\*|[a-z]+/(\*|[a-z0-9]+(-[a-z0-9]+)*))$'),
  predicate   text not null check (predicate in ('admin')),
  created_at  timestamptz not null default now(),
  unique (actor, object, predicate)
);

-- Maintain updated_at / created_by / updated_by.
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    if tg_table_name = 'recipes' then
      new.created_by := old.created_by;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    if tg_table_name = 'recipes' then
      new.created_by := coalesce(new.created_by, auth.uid());
    end if;
  end if;
  if tg_table_name = 'recipes' then
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

create trigger recipes_audit
  before insert or update on public.recipes
  for each row execute function public.set_audit_fields();

create trigger categories_audit
  before insert or update on public.categories
  for each row execute function public.set_audit_fields();
