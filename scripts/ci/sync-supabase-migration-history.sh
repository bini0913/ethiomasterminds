#!/usr/bin/env bash
set -euo pipefail

base_sha="${1:?Usage: sync-supabase-migration-history.sh BASE_SHA HEAD_SHA}"
head_sha="${2:?Usage: sync-supabase-migration-history.sh BASE_SHA HEAD_SHA}"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

git cat-file -e "${base_sha}^{commit}"
git cat-file -e "${head_sha}^{commit}"

added_migrations="$(git diff --name-only --diff-filter=A --no-renames "$base_sha" "$head_sha" -- supabase/migrations)"
if [[ -z "$added_migrations" ]]; then
  echo "No new migration files were added."
  exit 2
fi

source_dir="$(mktemp -d)"
trap 'rm -rf "$source_dir"' EXIT

while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  test -f "$path" || {
    echo "::error::New migration file not found: $path"
    exit 1
  }
  cp "$path" "$source_dir/"
done <<< "$added_migrations"

# The live project was migrated through the Supabase migration API, which
# generated remote version IDs different from the original repository names.
# Rebuild this CI runner's migration directory from the exact applied history.
# Never delete or rewrite the live migration history.
find supabase/migrations -maxdepth 1 -type f -name '*.sql' -delete
supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"
supabase migration fetch --linked

remote_max="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sed -E 's/^([0-9]+)_.*/\1/' | sort -n | tail -n 1)"
test -n "$remote_max" || {
  echo "::error::Could not fetch the production migration history."
  exit 1
}

while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  file="$source_dir/$(basename "$path")"
  version="$(basename "$file" | cut -d_ -f1)"
  if [[ "$version" -le "$remote_max" ]]; then
    echo "::error::New migration $path has version $version, not later than production's latest version $remote_max. Create a fresh migration with a later timestamp."
    exit 1
  fi
  cp "$file" supabase/migrations/
  echo "Prepared pending migration: $(basename "$file")"
done <<< "$added_migrations"

python3 - <<'PY'
from pathlib import Path
from collections import Counter

files = list(Path("supabase/migrations").glob("*.sql"))
versions = [path.name.split("_", 1)[0] for path in files]
duplicates = sorted(version for version, count in Counter(versions).items() if count > 1)
if duplicates:
    raise SystemExit(
        "Duplicate migration versions after history sync: " + ", ".join(duplicates)
    )
PY
