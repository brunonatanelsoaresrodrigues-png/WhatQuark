#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

stack_dir="${WHATICKET_STACK_DIR:-/opt/whaticket}"
backup_dir="${WHATICKET_BACKUP_DIR:-/var/backups/whaticket}"
compose_file="${WHATICKET_COMPOSE_FILE:-compose.production.yaml}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$backup_dir"
cd "$stack_dir"

if [[ ! -f "$compose_file" && -f compose.yaml ]]; then
  compose_file=compose.yaml
fi
if [[ ! -f .env || ! -f "$compose_file" ]]; then
  echo "Stack .env or compose file not found in $stack_dir" >&2
  exit 1
fi

mysql_password="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' .env)"
mysql_database="$(sed -n 's/^MYSQL_DATABASE=//p' .env)"
if [[ -z "$mysql_password" || ! "$mysql_database" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "MYSQL_ROOT_PASSWORD or a valid MYSQL_DATABASE is missing" >&2
  exit 1
fi

database_tmp="$backup_dir/.database-$stamp.sql.gz.tmp"
database_file="$backup_dir/database-$stamp.sql.gz"
docker compose --env-file .env -f "$compose_file" exec -T mariadb \
  mariadb-dump --single-transaction --quick --lock-tables=false \
  --routines --events --triggers -uroot -p"$mysql_password" "$mysql_database" \
  | gzip -9 > "$database_tmp"
gzip -t "$database_tmp"
mv "$database_tmp" "$database_file"

backend_id="$(docker compose --env-file .env -f "$compose_file" ps -q backend)"
if [[ -z "$backend_id" ]]; then
  echo "Backend container was not found" >&2
  exit 1
fi

volume_source() {
  local destination="$1"
  docker inspect --format "{{range .Mounts}}{{if eq .Destination \"$destination\"}}{{.Source}}{{end}}{{end}}" "$backend_id"
}

public_source="$(volume_source /usr/src/app/public)"
auth_source="$(volume_source /usr/src/app/.wwebjs_auth)"
if [[ ! -d "$public_source" || ! -d "$auth_source" ]]; then
  echo "Public or WhatsApp session volume could not be resolved" >&2
  exit 1
fi

tar -C "$public_source" -czf "$backup_dir/public-$stamp.tar.gz" .
tar -C "$auth_source" -czf "$backup_dir/auth-$stamp.tar.gz" .
tar -tzf "$backup_dir/public-$stamp.tar.gz" >/dev/null
tar -tzf "$backup_dir/auth-$stamp.tar.gz" >/dev/null

manifest="$backup_dir/manifest-$stamp.sha256"
(
  cd "$backup_dir"
  sha256sum "database-$stamp.sql.gz" "public-$stamp.tar.gz" "auth-$stamp.tar.gz" > "$manifest"
  sha256sum --check "$manifest"
)

find "$backup_dir" -xdev -type f -mtime "+${WHATICKET_BACKUP_RETENTION_DAYS:-14}" -delete
echo "Backup completed and verified: $manifest"
