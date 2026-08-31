#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

stack_dir=/opt/whaticket
backup_dir=/var/backups/whaticket
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
cd "$stack_dir"

docker compose --env-file .env -f compose.yaml exec -T mariadb \
  sh -lc 'mariadb-dump --single-transaction --quick --lock-tables=false -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip -9 > "$backup_dir/database-$stamp.sql.gz"
gzip -t "$backup_dir/database-$stamp.sql.gz"
printf 'BACKUP_OK=%s\n' "$backup_dir/database-$stamp.sql.gz"
stat -c 'BACKUP_BYTES=%s' "$backup_dir/database-$stamp.sql.gz"
