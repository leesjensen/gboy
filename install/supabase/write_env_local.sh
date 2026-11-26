#!/usr/bin/env bash
# Writes VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the repo's .env.local
# for the hosted project (default) or the local stack (--local).
source "$(dirname "$0")/lib.sh"
{ read -r api_url; read -r public_key; } < <(api_info)
[[ -n "$public_key" ]] || die "could not read the project's public API key"
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$api_url" "$public_key" > "$REPO_ROOT/.env.local"
log "Wrote $REPO_ROOT/.env.local ($TARGET: $api_url)"
