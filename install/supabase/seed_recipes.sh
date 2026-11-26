#!/usr/bin/env bash
# Generates install/supabase/seed.sql from data/recipes.json and loads it.
#   ./seed_recipes.sh [--local] [--force] [--prune] [recipes.json]
# By default only new recipe IDs are inserted, so edits made in the database
# are kept. --force overwrites existing rows with the JSON contents, except
# recipes saved in the app. --prune deletes recipes the JSON no longer has,
# except ones created or saved in the app.
# `supabase db reset` (local) also runs seed.sql automatically.
source "$(dirname "$0")/lib.sh"

mode=keep
prune=()
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --force) mode=overwrite ;;
    --prune) prune=(prune) ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
json="${1:-$REPO_ROOT/data/recipes.json}"
[[ -f "$json" ]] || die "not found: $json"

python3 "$SUPABASE_DIR/seed_recipes.py" "$json" "$SUPABASE_DIR/seed.sql" "$mode" ${prune[@]+"${prune[@]}"}
log "Loading seed.sql into the $TARGET database"
# Output stays on the terminal so the CLI can ask before changing a hosted project.
# shellcheck disable=SC2046
sb db query $(target_flag) -f "$SUPABASE_DIR/seed.sql"
sb db query $(target_flag) --read-only "select count(*) as recipes from public.recipes"
