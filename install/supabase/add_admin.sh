#!/usr/bin/env bash
# Grants the 'admin' predicate on an object to a user (by email), creating
# the auth user first if needed. Objects: '*' (default) or 'recipe/*'.
#   ./add_admin.sh [--local] person@example.com              admin of everything
#   ./add_admin.sh [--local] person@example.com 'recipe/*'   admin of recipes only
#   ./add_admin.sh [--local] --remove person@example.com ['recipe/*']
#   ./add_admin.sh [--local] --list
source "$(dirname "$0")/lib.sh"
# shellcheck disable=SC2046
# Writes keep stdout on the terminal so the CLI can ask before changing a hosted project.
query() { sb db query $(target_flag) "$1"; }
read_query() { sb db query $(target_flag) --read-only "$1"; }

if [[ "${1:-}" == "--list" ]]; then
  read_query "select u.email, r.predicate, r.object, r.created_at
    from public.roles r join auth.users u on u.id = r.actor
    order by u.email, r.object"
  exit 0
fi

remove=false
if [[ "${1:-}" == "--remove" ]]; then remove=true; shift; fi
email="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
object="${2:-*}"
[[ "$email" == *@*.* && "$email" != *"'"* ]] || die "usage: $0 [--local] [--remove] email@example.com ['*'|'recipe/*']  |  $0 [--local] --list"
[[ "$object" == "*" || "$object" == "recipe/*" ]] || die "object must be '*' or 'recipe/*'"

if $remove; then
  query "delete from public.roles r using auth.users u
    where u.id = r.actor and lower(u.email) = '$email'
      and r.object = '$object' and r.predicate = 'admin'"
  log "Removed admin on '$object' from $email (the auth user still exists)"
  exit 0
fi

# Create the auth user (sign-ups are disabled, so admins must be created here).
{ read -r api_url; read -r _; read -r secret_key; } < <(api_info)
[[ -n "$secret_key" ]] || die "could not read the project's secret API key"
response="$(curl -sS -w '\n%{http_code}' -X POST "$api_url/auth/v1/admin/users" \
  -H "apikey: $secret_key" -H "Authorization: Bearer $secret_key" \
  -H "Content-Type: application/json" \
  --data-binary "$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "email_confirm": True}))' "$email")")"
status="${response##*$'\n'}"
case "$status" in
  200|201) log "Created auth user $email" ;;
  422) [[ "$response" == *email_exists* || "$response" == *"already been registered"* ]] \
         || die "could not create auth user: ${response%$'\n'*}" ;;
  *) die "could not create auth user (HTTP $status): ${response%$'\n'*}" ;;
esac

query "insert into public.roles (actor, object, predicate)
  select id, '$object', 'admin' from auth.users where lower(email) = '$email'
  on conflict (actor, object, predicate) do nothing"
log "$email is admin on '$object'"
