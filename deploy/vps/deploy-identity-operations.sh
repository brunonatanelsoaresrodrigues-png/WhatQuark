#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
production_compose="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
check_db=whaticket_release_check
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-identity-ops-$stamp.yaml"
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"

cleanup() {
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
    sh -lc 'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_release_check"' >/dev/null 2>&1 || true
}
trap cleanup EXIT

gzip -t "$latest_backup"
docker compose --env-file "$env_file" -f "$release_compose" config --quiet
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  whaticket-backend:identity-ops-ai-20260831-0130 \
  -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

cd "$stack_dir"
docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_release_check; CREATE DATABASE whaticket_release_check CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"'
gzip -dc "$latest_backup" | docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" whaticket_release_check'

docker compose --env-file "$env_file" -f "$release_compose" run --rm --no-deps \
  -e DB_NAME="$check_db" backend sh -lc \
  'npx sequelize --config dist/config/database.js --migrations-path dist/database/migrations --seeders-path dist/database/seeds db:migrate'

table_count="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" whaticket_release_check -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (\"ContactIdentityIssues\",\"ContactQuarkLinks\",\"ContactIdentityAudits\",\"OperationalIncidents\",\"AiSuggestions\")"' | tr -d '\r')"
[ "$table_count" = "5" ] || { echo "MIGRATION_CHECK_FAILED=$table_count" >&2; exit 1; }
echo "MIGRATION_CHECK_OK=5"

before_messages="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
before_channels="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
echo "BEFORE_MESSAGES=$before_messages"
echo "BEFORE_CHANNELS=$before_channels"

cp "$production_compose" "$compose_backup"
cp "$release_compose" "$production_compose"
install -m 700 "$release_dir/backup.sh" /usr/local/sbin/whaticket-backup

backup_bytes="$(stat -c %s "$latest_backup")"
health_tmp=/var/backups/whaticket/.health-$stamp.json
printf '{"completedAt":"%s","verified":true,"sizeBytes":%s,"database":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup_bytes" "$(basename "$latest_backup")" > "$health_tmp"
mv "$health_tmp" /var/backups/whaticket/health.json

rollback() {
  echo "DEPLOY_ROLLBACK_STARTED" >&2
  cp "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend frontend || true
}
trap 'rollback; cleanup' ERR

docker compose --env-file "$env_file" -f "$production_compose" config --quiet
docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend

healthy=false
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ] || {
  docker compose --env-file "$env_file" -f "$production_compose" logs --tail 120 backend >&2
  false
}

docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ >/dev/null; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ]

after_messages="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb \
  sh -lc 'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
echo "AFTER_MESSAGES=$after_messages"
echo "AFTER_CHANNELS=$after_channels"
echo "COMPOSE_BACKUP=$compose_backup"
echo "DEPLOY_OK"

trap cleanup EXIT
