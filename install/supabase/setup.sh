#!/usr/bin/env bash
# Sets up the hosted project end to end. Safe to re-run.
#   ./setup.sh [--yes] [admin@example.com ...]
# Run `supabase login` first. The CLI asks before changing the hosted project;
# pass --yes (or export SUPABASE_YES=1) to run unattended.
if [[ "${1:-}" == "--yes" ]]; then
  export SUPABASE_YES=1
  shift
fi
source "$(dirname "$0")/lib.sh"
dir="$SUPABASE_DIR"
[[ -n "${SITE_URL:-}" ]] || die "SITE_URL is not set (copy install/supabase/.env.example to install/supabase/.env)"

ref="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$ref" && -s "$dir/.temp/project-ref" ]]; then
  ref="$(cat "$dir/.temp/project-ref")"
fi

if [[ -z "$ref" ]]; then
  for name in SUPABASE_ORG_ID SUPABASE_PROJECT_NAME SUPABASE_REGION SUPABASE_DB_PASSWORD; do
    [[ -n "${!name:-}" ]] || die "$name is required to create a project (or set SUPABASE_PROJECT_REF)"
  done
  # -o json stops the CLI from prompting, so confirm here and pass --yes.
  if [[ -z "${SUPABASE_YES:-}" ]]; then
    read -r -p "Create project \"$SUPABASE_PROJECT_NAME\" in organization $SUPABASE_ORG_ID? [y/N] " answer
    [[ "$answer" == [yY]* ]] || die "not creating the project"
  fi
  log "Creating project $SUPABASE_PROJECT_NAME"
  ref="$(sb projects create --yes "$SUPABASE_PROJECT_NAME" --org-id "$SUPABASE_ORG_ID" \
    --db-password "$SUPABASE_DB_PASSWORD" --region "$SUPABASE_REGION" -o json | python3 -c 'import json,sys; p=json.load(sys.stdin); print(p.get("id") or p["ref"])')"
  log "Created project $ref; add SUPABASE_PROJECT_REF=$ref to install/supabase/.env"
fi

log "Waiting for project $ref to be healthy"
for _ in $(seq 1 60); do
  status="$(sb projects list -o json | python3 -c '
import json, sys
print(next((p.get("status", "") for p in json.load(sys.stdin) if sys.argv[1] in (p.get("id"), p.get("ref"))), "MISSING"))' "$ref")"
  [[ "$status" == ACTIVE_HEALTHY ]] && break
  [[ "$status" == MISSING ]] && die "project $ref not found for this login"
  echo "    status: $status"
  sleep 10
done
[[ "$status" == ACTIVE_HEALTHY ]] || die "project is not healthy (status: $status)"

log "Linking install/supabase to $ref"
sb link --project-ref "$ref"

log "Applying migrations"
sb db push --remote ${SUPABASE_DB_PASSWORD:+--password "$SUPABASE_DB_PASSWORD"}

log "Seeding recipes"
"$dir/seed_recipes.sh"

log "Pushing auth config (email OTP, sign-ups off)"
sb config push

for email in "$@"; do
  "$dir/add_admin.sh" "$email"
done

"$dir/write_env_local.sh"
log "Done"
