-- Star ratings (1-5) from signed-in users: one rating per user per recipe,
-- which they can change or remove. Individual ratings are private to the
-- rater (and recipe admins, for moderation); everyone can read the per-recipe
-- average and count in recipe_rating_stats.
--   supabase.rpc('rate_recipe', { p_recipe_id: 'chicken-alfredo', p_stars: 5 })
--   supabase.rpc('rate_recipe', { p_recipe_id: 'chicken-alfredo', p_stars: null })  -- remove

create table public.ratings (
  recipe_id   text not null references public.recipes (id) on update cascade on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

create index ratings_user_idx on public.ratings (user_id);

-- Per-recipe totals, maintained by the trigger below. A row exists only while
-- a recipe has at least one rating. No foreign key to recipes: when a recipe
-- is deleted its ratings cascade away and the trigger removes this row.
create table public.recipe_rating_stats (
  recipe_id       text primary key,
  rating_count    integer not null check (rating_count > 0),
  rating_sum      integer not null,
  rating_average  numeric(3, 2) generated always as (round(rating_sum::numeric / rating_count, 2)) stored
);

create index recipe_rating_stats_rank_idx on public.recipe_rating_stats (rating_average desc, rating_count desc);

create function public.refresh_recipe_rating_stats(p_recipe_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
  sum_stars integer;
begin
  select count(*), coalesce(sum(stars), 0) into total, sum_stars
  from public.ratings
  where recipe_id = p_recipe_id;

  if total = 0 then
    delete from public.recipe_rating_stats where recipe_id = p_recipe_id;
  else
    insert into public.recipe_rating_stats (recipe_id, rating_count, rating_sum)
    values (p_recipe_id, total, sum_stars)
    on conflict (recipe_id) do update
      set rating_count = excluded.rating_count, rating_sum = excluded.rating_sum;
  end if;
end;
$$;

revoke all on function public.refresh_recipe_rating_stats(text) from public, anon, authenticated;

create function public.ratings_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_recipe_rating_stats(old.recipe_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.recipe_id is distinct from old.recipe_id) then
    perform public.refresh_recipe_rating_stats(new.recipe_id);
  end if;
  return null;
end;
$$;

revoke all on function public.ratings_changed() from public, anon, authenticated;

create trigger ratings_refresh_stats
  after insert or update or delete on public.ratings
  for each row execute function public.ratings_changed();

-- Rate (1-5) or, with null, remove your rating of a recipe.
create function public.rate_recipe(p_recipe_id text, p_stars integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to rate recipes.' using errcode = '42501';
  end if;
  if p_stars is null then
    delete from public.ratings where recipe_id = p_recipe_id and user_id = (select auth.uid());
  else
    insert into public.ratings (recipe_id, user_id, stars)
    values (p_recipe_id, (select auth.uid()), p_stars)
    on conflict (recipe_id, user_id) do update
      set stars = excluded.stars, updated_at = now();
  end if;
end;
$$;

revoke all on function public.rate_recipe(text, integer) from public, anon;
grant execute on function public.rate_recipe(text, integer) to authenticated;

-- Lets a signed-in user delete their own account (and, by cascade, their
-- ratings and any role grants).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Row level security.
alter table public.ratings enable row level security;
alter table public.recipe_rating_stats enable row level security;

revoke all on public.ratings, public.recipe_rating_stats from anon, authenticated;
grant select, delete on public.ratings to authenticated;
grant insert (recipe_id, user_id, stars) on public.ratings to authenticated;
grant update (stars, updated_at) on public.ratings to authenticated;
grant select on public.recipe_rating_stats to anon, authenticated;

create policy "Users see their own ratings; admins see all"
  on public.ratings for select
  to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin', 'recipe/' || recipe_id));

create policy "Users add their own ratings"
  on public.ratings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own ratings"
  on public.ratings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users remove their own ratings; admins remove any"
  on public.ratings for delete
  to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin', 'recipe/' || recipe_id));

create policy "Anyone can read rating totals"
  on public.recipe_rating_stats for select
  to anon, authenticated
  using (true);
