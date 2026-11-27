# Supabase setup

This folder is a [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) project. It moves the recipe collection from `data/recipes.json` into Postgres. Anyone can read recipes. Anyone can sign in with an emailed one-time link to rate recipes; admins use the same sign-in to create, update, and delete them in the app.

The scripts run the CLI with `--workdir install`, so `install/supabase/` acts as the project's `supabase/` folder. To run CLI commands yourself, use `supabase --workdir install <command>`.

## Requirements

- Supabase CLI 3.x: `brew install supabase/tap/supabase`
- `python3` and `curl`
- Docker, only for the local stack

## Configure

```sh
supabase login
cp install/supabase/.env.example install/supabase/.env
```

In `.env`, set `SITE_URL` and `SUPABASE_DB_PASSWORD`. Then set `SUPABASE_PROJECT_REF` for an existing project, or `SUPABASE_ORG_ID` (from `supabase orgs list`) to create a new one. The CLI also reads this file for the `env(...)` values in `config.jsonc`. It is git-ignored.

## Hosted project

```sh
install/supabase/setup.sh admin@example.com
```

This creates the project (when needed) and waits until it is healthy. It then links the folder to it, runs `db push` to apply `migrations/`, loads the recipes, and runs `config push` for the auth settings. It also creates the admin and writes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the repo's `.env.local`. The CLI shows each hosted change and asks before applying it. Pass `--yes` (or export `SUPABASE_YES=1`) to run unattended. Every step is safe to re-run.

## Local stack

```sh
install/supabase/local.sh admin@example.com
```

This starts Supabase in Docker and runs `db reset` to rebuild the database from the migrations and `seed.sql`. It then adds the admin and points `.env.local` at the local API. Sign-in emails go to the local mail viewer that `supabase status` lists, so you can test sign-in without SMTP. Run `supabase --workdir install stop` when you're done.

## Files and scripts

| Path | Purpose |
| --- | --- |
| `config.jsonc` | Declares only the settings this project relies on: the seed path, site and redirect URLs, sign-ups on with email confirmation (so anyone can sign in to rate, but not with a made-up address), email sign-in (links expire after 10 minutes). `config push` changes just these on the hosted project. Commented `smtp` and email template blocks are ready for a real mail server |
| `migrations/` | Schema (`categories`, `recipes`, `roles`, audit triggers, full-text `search` column), the ranked `search_recipes` function, public read RLS, and role-based write RLS |
| `templates/magic_link.html` | A sign-in email that shows a 6-digit code (`{{ .Token }}`). Unused until custom SMTP is set up, because the free plan doesn't allow custom templates with the built-in mailer |
| `seed_recipes.sh [--local] [--force] [--prune]` | Generates `seed.sql` from `data/recipes.json` and loads it. By default only new IDs are inserted, so database edits are kept. `--force` overwrites existing rows with the JSON. `--prune` deletes recipes the JSON no longer has, except ones created or saved in the app |
| `add_admin.sh [--local] [--remove] email ['*'\|'recipe/*']` | Creates the auth user if needed and grants (or removes) `admin` on `*` (default) or `recipe/*`. `--list` shows all grants |
| `write_env_local.sh [--local]` | Writes the app's `.env.local` for the hosted or local API |

Scripts target the linked hosted project unless the first argument is `--local`.

To change the schema, add a migration with `supabase --workdir install migration new <name>`, test it with `local.sh`, and then run `supabase --workdir install db push`.

Supabase's built-in mailer only sends a few emails per hour, shared by everyone signing in, so admins can be locked out of sign-in while it's used up. Now that anyone can sign in to rate, enable the `smtp` block in `config.jsonc` and run `config push` before sharing the site widely.

## Recipe photo import

`functions/import-recipe` is an Edge Function that reads a recipe from a photo with Gemini. The app (`#/import`) shrinks the photo to 2000px, sends it with the chosen category and that category's subcategories, and opens the result in the recipe editor as a draft; nothing is saved until an admin reviews it and clicks **Add recipe**. Photos are not stored. The function checks the caller's session and `has_role('admin', 'recipe/*')` itself, so `verify_jwt` is off for it in `config.jsonc`.

Set the Gemini key once (in your own terminal, so the key stays out of logs), then deploy:

```sh
supabase --workdir install secrets set GEMINI_API_KEY=your-key
supabase --workdir install functions deploy import-recipe --use-api --no-verify-jwt
```

The function uses `gemini-3.8-flash`; set a `GEMINI_MODEL` secret to use another model. Redeploy after changing the function or its prompt.

## Data model

`recipes` mirrors the JSON records: `id` (kebab-case, stable), `title`, `category_id`, `subcategory`, `source` (where the recipe came from, split out of titles written as "Dish (from Source)"), `source_page`, `source_end_page`, `blocks` (`jsonb` array of `{type, text}`), and `source_text`. It also has `created_at`, `updated_at`, `created_by`, and `updated_by`, which triggers maintain. `search` is a generated, weighted `tsvector` (title, then subcategory and source, then recipe text) with a GIN index. The app searches it through `search_recipes(p_query, p_limit)`, which requires every word (each also matching as a prefix), ranks title matches first, and returns the first matching recipe line.

Permissions live in `roles` as actor / object / predicate triples:

| Column | Meaning | Values today |
| --- | --- | --- |
| `actor` | The auth user the grant applies to | Admin users |
| `object` | What the grant applies to: `*`, `<type>/*`, or `<type>/<id>` | `*` or `recipe/*` |
| `predicate` | The actor's relationship to the object | `admin` |

RLS checks each row as an object, for example `recipe/baked-mushrooms-lindsey-fellars` or `category/desserts`, using `public.has_role(predicate, object)`. A grant matches when its object is `*`, the row's `<type>/*`, or the exact object. So `*` admins can write recipes and categories, and `recipe/*` admins can write recipes only. `roles` has no client write policies, so grants can only be managed with `add_admin.sh` or the SQL editor. To add a predicate or object type, write a migration that changes the `roles` check constraint, and update the allowed objects in `add_admin.sh`.

Ratings live in `ratings`: one 1–5 rating per user per recipe, primary key `(recipe_id, user_id)`. A rating is visible only to the person who made it and to recipe admins, who can also remove it. The app calls `rate_recipe(p_recipe_id, p_stars)` to set a rating, or passes `null` to remove it. A trigger keeps `recipe_rating_stats` (count, sum, average) current, and anyone can read it; the app merges those totals into the recipe summaries. Deleting a recipe or an account removes the related ratings. `delete_my_account()` lets a signed-in person delete their own account from the account page.

## Using it from the app

`src/supabase.js` creates the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and holds every query. The app loads categories and recipe summaries (no recipe text) on start, paging past PostgREST's 1,000-row limit, and fetches each recipe's full text when it is opened. People sign in at `#/account` with `signInWithOtp` (PKCE flow, so the link returns with `?code=` and leaves the `#/` routes alone). The link must return to `SITE_URL` or one of `additional_redirect_urls`. The app calls `has_role('admin', 'recipe/*')` to decide whether to show the editing controls; RLS enforces the same rule on every write.

For GitHub Pages builds, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables; `.github/workflows/deploy.yml` passes them to the build. The anon key is meant to be public, and RLS protects the data.
