#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

stack_dir=/opt/whaticket
backup_dir=/var/backups/whaticket
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_remote="${BACKUP_REMOTE:-$(sed -n 's/^BACKUP_REMOTE=//p' "$stack_dir/.env" 2>/dev/null)}"

mkdir -p "$backup_dir"
cd "$stack_dir"

docker compose --env-file .env -f compose.yaml exec -T mariadb \
  sh -lc 'mariadb-dump --single-transaction --quick --lock-tables=false -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip -9 > "$backup_dir/database-$stamp.sql.gz"

tar -C /var/lib/docker/volumes/whaticket_backend_public/_data \
  -czf "$backup_dir/public-$stamp.tar.gz" .
tar -C /var/lib/docker/volumes/whaticket_backend_auth/_data \
  -czf "$backup_dir/auth-$stamp.tar.gz" .

gzip -t "$backup_dir/database-$stamp.sql.gz"
tar -tzf "$backup_dir/public-$stamp.tar.gz" >/dev/null
tar -tzf "$backup_dir/auth-$stamp.tar.gz" >/dev/null

backup_bytes="$(du -cb \
  "$backup_dir/database-$stamp.sql.gz" \
  "$backup_dir/public-$stamp.tar.gz" \
  "$backup_dir/auth-$stamp.tar.gz" | tail -n 1 | cut -f 1)"
health_tmp="$backup_dir/.health-$stamp.json"
printf '{"completedAt":"%s","verified":true,"sizeBytes":%s,"database":"database-%s.sql.gz"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup_bytes" "$stamp" > "$health_tmp"
mv "$health_tmp" "$backup_dir/health.json"

if [[ -n "$backup_remote" ]]; then
  command -v rclone >/dev/null || {
    echo "BACKUP_REMOTE is configured but rclone is unavailable" >&2
    exit 1
  }
  rclone copy "$backup_dir/database-$stamp.sql.gz" "$backup_remote/"
  rclone copy "$backup_dir/public-$stamp.tar.gz" "$backup_remote/"
  rclone copy "$backup_dir/auth-$stamp.tar.gz" "$backup_remote/"
fi

find "$backup_dir" -xdev -type f ! -name health.json -mtime +7 -delete
