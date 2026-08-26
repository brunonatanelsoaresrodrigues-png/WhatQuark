#!/usr/bin/env bash
set -Eeuo pipefail

backup_dir="${1:?Usage: verify-production-backup.sh BACKUP_DIR [STAMP]}"
stamp="${2:-$(find "$backup_dir" -maxdepth 1 -name 'manifest-*.sha256' -printf '%f\n' | sort | tail -n 1 | sed -E 's/^manifest-(.*)\.sha256$/\1/')}"
manifest="$backup_dir/manifest-$stamp.sha256"

if [[ -z "$stamp" || ! -f "$manifest" ]]; then
  echo "Backup manifest not found" >&2
  exit 1
fi

(
  cd "$backup_dir"
  sha256sum --check "$(basename "$manifest")"
  gzip -t "database-$stamp.sql.gz"
  tar -tzf "public-$stamp.tar.gz" >/dev/null
  tar -tzf "auth-$stamp.tar.gz" >/dev/null
)

if ! zgrep -am1 -Eq 'MariaDB dump|MySQL dump' "$backup_dir/database-$stamp.sql.gz"; then
  echo "Database dump header is invalid" >&2
  exit 1
fi

echo "Backup $stamp is structurally valid"
