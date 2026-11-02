# GBoy Recipe Book

A client-side recipe browser built with Vite, React, and Tailwind CSS. Recipe records load from `public/recipes.json`, so the app can be deployed as static files without a server or database. Hash-based navigation keeps category and recipe pages compatible with GitHub Pages hosting.

## Run locally

```sh
npm ci
npm run dev
```

Vite prints the local address. Create a production build with `npm run build`; preview that build with `npm run preview`.

## Browse and update recipes

The recipe collection is in `public/recipes.json`. Records include a stable ID, category and subcategory, source page, formatted recipe blocks, and the source transcription. The PDF is the source of truth. The text is ready to index when search is added. To rebuild the extracted collection on macOS:

```sh
swift scripts/extract_pdf_lines.swift gboy.pdf /tmp/gboy-lines.json
python3 scripts/build_recipe_data.py /tmp/gboy-lines.json
```

Review the affected recipe titles and text after regeneration, especially entries that span pages or appear in multiple columns. Keep source page numbers with recipe records so readers can trace a transcription back to the collection.

## Structure

- `src/App.jsx` contains the home page, category browser, recipe detail view, and hash routing.
- `src/index.css` defines the Tailwind theme and global styles.
- `public/recipes.json` is the static recipe dataset fetched by the app.
- `scripts/` contains the macOS PDF text extractor and dataset builder.

Use clear, descriptive component names and keep visual styles consistent with the existing warm, editorial palette. Recipe content should remain data-driven rather than hard-coded into components.
