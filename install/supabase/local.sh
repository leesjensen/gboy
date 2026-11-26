#!/usr/bin/env bash
# Starts the local Supabase stack (Docker), rebuilds the database from the
# migrations and seed, and points the app at it.
#   ./local.sh [admin@example.com ...]
# Sign-in emails are caught by the local mail viewer (Mailpit) printed by
# `supabase status`, so OTP codes can be tested without SMTP.
source "$(dirname "$0")/lib.sh"
dir="$SUPABASE_DIR"
export SITE_URL="${SITE_URL:-http://localhost:5173/}"

python3 "$dir/seed_recipes.py" "$REPO_ROOT/data/recipes.json" "$dir/seed.sql" keep
log "Starting the local stack"
sb start
log "Resetting the local database (migrations + seed.sql)"
sb db reset

for email in "$@"; do
  "$dir/add_admin.sh" --local "$email"
done

"$dir/write_env_local.sh" --local
sb status
