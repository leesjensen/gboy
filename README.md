# GBoy Recipe Book

A recipe browser built with Vite, React, and Tailwind CSS. Recipes live in a hosted [Supabase](https://supabase.com) Postgres database that the browser reads directly, so the site still deploys as static files. Anyone can browse; admins sign in with an emailed link to add, edit, and delete recipes. Hash-based navigation keeps pages compatible with GitHub Pages hosting.

## Run locally

```sh
npm ci
install/supabase/write_env_local.sh   # writes VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
npm run dev
```

See `install/supabase/README.md` to create the database and add admins. Vite prints the local address. Create a production build with `npm run build`; preview that build with `npm run preview`.

## Browse and update recipes

Admins edit recipes in the app: open **Admin** in the footer, sign in with the emailed link, then use **Add recipe** or a recipe's **Edit** button. Recipe IDs never change after creation, so links keep working.

The original extraction is in `data/recipes.json`, which seeds the database (`install/supabase/seed_recipes.sh`). Edits made in the app live only in the database. Records include a stable ID, category and subcategory, source page, formatted recipe blocks, and the source transcription. The PDF is the source of truth. The text is ready to index when search is added. To rebuild the extracted collection on macOS:

```sh
swift scripts/extract_pdf_lines.swift gboy.pdf /tmp/gboy-lines.json
python3 scripts/build_recipe_data.py /tmp/gboy-lines.json
```

Review the affected recipe titles and text after regeneration, especially entries that span pages or appear in multiple columns. Keep source page numbers with recipe records so readers can trace a transcription back to the collection.

## Structure

- `src/App.jsx` contains the home page, category browser, recipe detail view, data loading, and hash routing.
- `src/Admin.jsx` contains admin sign-in and the recipe editor.
- `src/supabase.js` creates the Supabase client and holds every query.
- `src/ui.jsx` has shared icons and breadcrumbs.
- `src/index.css` defines the Tailwind theme and global styles.
- `data/recipes.json` is the extracted dataset used to seed the database. It is not shipped with the site.
- `install/supabase/` holds the database schema, auth config, and setup scripts.
- `scripts/` contains the macOS PDF text extractor, the dataset builder, and `rebuild_blocks.py`, which re-splits each recipe's `sourceText` into ingredients, steps, and notes after the block rules change.

Use clear, descriptive component names and keep visual styles consistent with the existing warm, editorial palette. Recipe content should remain data-driven rather than hard-coded into components.
