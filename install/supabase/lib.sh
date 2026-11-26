#!/usr/bin/env bash
# Shared helpers for the Supabase scripts. Source, don't run.
#
# Every script targets the hosted (linked) project by default, or the local
# Docker stack when given --local as its first argument.
set -euo pipefail

SUPABASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(dirname "$SUPABASE_DIR")"
REPO_ROOT="$(dirname "$INSTALL_DIR")"

if [[ -f "$SUPABASE_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SUPABASE_DIR/.env"
  set +a
fi

die() { echo "error: $*" >&2; exit 1; }
log() { echo "==> $*"; }

command -v supabase >/dev/null || die "the Supabase CLI is required: brew install supabase/tap/supabase (see https://supabase.com/docs/guides/local-development/cli/getting-started)"
command -v curl >/dev/null || die "curl is required"
command -v python3 >/dev/null || die "python3 is required"

# Run the CLI against install/supabase.
sb() { supabase --workdir "$INSTALL_DIR" "$@"; }

TARGET=remote
if [[ "${1:-}" == "--local" ]]; then
  TARGET=local
  shift
fi
target_flag() { [[ "$TARGET" == remote ]] && echo "--remote" || true; }

linked_ref() {
  local file="$SUPABASE_DIR/.temp/project-ref"
  [[ -s "$file" ]] || die "no linked project; run install/supabase/setup.sh (or: supabase --workdir install link)"
  cat "$file"
}

# api_info → prints the API URL, public key and secret key, one per line.
# Read with: { read -r url; read -r public_key; read -r secret_key; } < <(api_info)
api_info() {
  if [[ "$TARGET" == local ]]; then
    sb status -o json | python3 -c '
import json, sys
s = json.load(sys.stdin)
pick = lambda *names: next((s[n] for n in names if s.get(n)), "")
print(pick("API_URL"), pick("PUBLISHABLE_KEY", "ANON_KEY"), pick("SECRET_KEY", "SERVICE_ROLE_KEY"), sep="\n")'
  else
    local ref
    ref="$(linked_ref)"
    sb projects api-keys --reveal -o json | python3 -c '
import json, sys
keys = json.load(sys.stdin)
def pick(*wanted):
    for want in wanted:
        for k in keys:
            if want in (k.get("name"), k.get("type")) and k.get("api_key"):
                return k["api_key"]
    return ""
print("https://" + sys.argv[1] + ".supabase.co", pick("anon", "publishable"), pick("service_role", "secret"), sep="\n")' "$ref"
  fi
}
