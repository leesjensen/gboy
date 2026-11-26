# Repository Guidelines

## Purpose and Current State

This is a recipe browser for GBoy, the Giant Book of Yum (`gboy.pdf`, 273 pages): recipes Lisa Jensen compiled from many sources and shares with her children. Use "GBoy" or "Giant Book of Yum" in user-facing copy. It has a welcoming home page, 12 recipe categories, category filters, a detail page for each entry, and admin editing. Recipes (about 822) live in a hosted Supabase Postgres database that the browser queries directly; there is no app server. `data/recipes.json` is the original extraction used to seed it. Search (`#/search/:query`, `src/Search.jsx`) calls the `search_recipes` database function, which ranks matches on the weighted `recipes.search` column (title, then subcategory, then recipe text).

## Architecture

- `src/App.jsx` implements the pages, data loading, and lightweight hash routing (`#/category/:id`, `#/recipe/:id`, `#/recipe/:id/edit`, `#/new[/:category]`, `#/admin`, `#/search/:query`).
- `src/Import.jsx` (`#/import[/:category]`) sends a recipe photo to the `import-recipe` Edge Function in `install/supabase/functions/`, which calls Gemini (key in Supabase secrets) and returns a draft for the editor; it never writes to the database.
- `src/Admin.jsx` has magic-link sign-in and the recipe editor; `src/supabase.js` has the client and all queries; `src/ui.jsx` has shared `Icon` and `Breadcrumbs`.
- `src/main.jsx` mounts React; `src/index.css` contains the Tailwind theme and shared styles.
- The app loads category and recipe summaries on start and each recipe's full text when it is opened. It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (`.env.local` locally, repository variables in CI). Row-level security allows public reads and writes only for users with an `admin` grant in `public.roles`.
- `install/supabase/` is the Supabase CLI project (migrations, auth config, setup scripts); see its README.
- `scripts/extract_pdf_lines.swift` uses macOS PDFKit; `scripts/build_recipe_data.py` builds the JSON dataset. `README.md` has the refresh commands.

Keep Vite's relative `base: './'` and hash navigation for eventual GitHub Pages project-site hosting. `.github/workflows/deploy.yml` deploys `main` to GitHub Pages.

## Commands

- `npm ci` installs lockfile dependencies.
- `npm run dev` starts Vite locally.
- `npm run build` writes the static site to `dist/`.
- `npm run preview` serves the production build locally.

## Recipe Data and Review

Recipes are normally edited in the app. To re-extract, run `swift scripts/extract_pdf_lines.swift gboy.pdf /tmp/gboy-lines.json` followed by `python3 scripts/build_recipe_data.py /tmp/gboy-lines.json`, then `install/supabase/seed_recipes.sh` (new IDs only; `--force` overwrites database edits; `--prune` removes recipes dropped from the JSON unless they were created or saved in the app). To re-tune how lines become blocks (`recipe_blocks()` in `scripts/build_recipe_data.py`) without re-extracting, run `python3 scripts/rebuild_blocks.py`; it rebuilds blocks from each recipe's `sourceText`. The PDF has multiple columns and recipes that cross pages, so extraction is heuristic. Review titles, category assignments, and ingredient/instruction boundaries after regeneration; page 10 has brief Belgian family notes that are represented as short entries. Preserve `sourcePage` and source text. Keep existing lowercase kebab-case IDs stable when editing titles, since links use those IDs.

## Style and Validation

Use two-space indentation, PascalCase React components, and camelCase helpers. Keep recipe text in the database (not in components), queries in `src/supabase.js`, and shared colors in `src/index.css`. Schema changes go in new migrations under `install/supabase/migrations/`. There is no automated test suite. Run `npm run build` after code or data changes and visually review affected recipe/category pages when a browser is available.

No Git history or repository metadata is present here. If commits are introduced, use short imperative subjects and focused changes.
