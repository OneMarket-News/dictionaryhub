#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/dictionaryroot-$STAMP.dump"
pg_dump --format=custom --no-owner --no-acl --file="$OUT" "$DATABASE_URL"
sha256sum "$OUT" > "$OUT.sha256"
printf 'Created %s\n' "$OUT"
