-- More category colors for admins to choose from (#/categories). Each tint
-- needs a matching .tint-* rule in src/index.css and an entry in
-- src/Categories.jsx.

alter table public.categories
  drop constraint categories_tint_check,
  add constraint categories_tint_check check (tint in (
    'coral', 'peach', 'gold', 'lemon', 'sage', 'mint',
    'blue', 'sky', 'lavender', 'rose', 'sand', 'slate'
  ));
