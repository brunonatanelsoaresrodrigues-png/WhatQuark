#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

stack_dir=/opt/whaticket
backup_dir=/var/backups/whaticket
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$backup_dir"
cd "$stack_dir"

mysql_password="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' .env)"
if [[ -z "$mysql_password" ]]; then
  echo "MYSQL_ROOT_PASSWORD is missing" >&2
  exit 1
fi

docker compose --env-file .env -f compose.yaml exec -T mariadb \
  mariadb-dump --single-transaction --quick --lock-tables=false \
  -uroot -p"$mysql_password" whaticket \
  | gzip -9 > "$backup_dir/database-$stamp.sql.gz"

tar -C /var/lib/docker/volumes/whaticket_backend_public/_data \
  -czf "$backup_dir/public-$stamp.tar.gz" .
tar -C /var/lib/docker/volumes/whaticket_backend_auth/_data \
  -czf "$backup_dir/auth-$stamp.tar.gz" .

find "$backup_dir" -xdev -type f -mtime +7 -delete
