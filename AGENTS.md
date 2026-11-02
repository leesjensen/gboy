# Repository Guidelines

## Purpose and Current State

This is a client-side recipe browser built from `gboy.pdf`, a 273-page family cookbook. It currently has a welcoming home page, 12 recipe categories, category filters, and a dedicated detail page for each entry. `public/recipes.json` contains about 822 extracted entries. Search is a future requirement and is not implemented yet; keep recipe data easy to index without adding a server or database.

## Architecture

- `src/App.jsx` implements the pages, reusable components, and lightweight hash routing (`#/category/:id`, `#/recipe/:id`).
- `src/main.jsx` mounts React; `src/index.css` contains the Tailwind theme and shared styles.
- The app fetches `public/recipes.json` at runtime so recipe content stays out of the initial JavaScript bundle.
- `scripts/extract_pdf_lines.swift` uses macOS PDFKit; `scripts/build_recipe_data.py` builds the JSON dataset. `README.md` has the refresh commands.

Keep Vite's relative `base: './'` and hash navigation for eventual GitHub Pages project-site hosting. No deployment workflow is configured yet.

## Commands

- `npm ci` installs lockfile dependencies.
- `npm run dev` starts Vite locally.
- `npm run build` writes the static site to `dist/`.
- `npm run preview` serves the production build locally.

## Recipe Data and Review

Regenerate with `swift scripts/extract_pdf_lines.swift gboy.pdf /tmp/gboy-lines.json` followed by `python3 scripts/build_recipe_data.py /tmp/gboy-lines.json`. The PDF has multiple columns and recipes that cross pages, so extraction is heuristic. Review titles, category assignments, and ingredient/instruction boundaries after regeneration; page 10 has brief Belgian family notes that are represented as short entries. Preserve `sourcePage` and source text. Keep existing lowercase kebab-case IDs stable when editing titles, since links use those IDs.

## Style and Validation

Use two-space indentation, PascalCase React components, and camelCase helpers. Keep recipe text in JSON and shared colors in `src/index.css`. There is no automated test suite. Run `npm run build` after code or data changes and visually review affected recipe/category pages when a browser is available.

No Git history or repository metadata is present here. If commits are introduced, use short imperative subjects and focused changes.
