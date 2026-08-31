#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-service-ratings-20260831-1500.tar.gz
backend_image=whaticket-backend:service-ratings-20260831-1500
frontend_image=whaticket-frontend:service-ratings-20260831-1500
check_db=whaticket_service_rating_check
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-service-ratings-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:unofficial-consent-policy-20260831-1100 \
  --build-arg SOURCE_REVISION=service-ratings-20260831-1500 \
  -t "$backend_image" .
docker build -f deploy/vps/frontend.Dockerfile \
  --build-arg FRONTEND_BASE_IMAGE=whaticket-frontend:emoji-picker-20260831-1100 \
  --build-arg SOURCE_REVISION=service-ratings-20260831-1500 \
  -t "$frontend_image" .
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  "$backend_image" -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
before_messages="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
before_channels="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"

/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp "$production_compose" "$compose_backup"

cleanup_check_db() {
  cd "$stack_dir"
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_service_rating_check"' \
    >/dev/null 2>&1 || true
}
trap cleanup_check_db EXIT

"${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_service_rating_check; CREATE DATABASE whaticket_service_rating_check CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"'
gzip -dc "$latest_backup" | "${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" whaticket_service_rating_check'

docker compose --env-file "$env_file" -f "$release_compose" config --quiet
docker compose --env-file "$env_file" -f "$release_compose" run --rm --no-deps \
  -e DB_NAME="$check_db" backend sh -lc \
  'npx sequelize --config dist/config/database.js --migrations-path dist/database/migrations --seeders-path dist/database/seeds db:migrate'

check_result="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" whaticket_service_rating_check -e "SELECT CONCAT((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=\"ServiceRatings\"),0x3A,(SELECT COUNT(*) FROM Settings WHERE \`key\` LIKE \"serviceRating%\"),0x3A,(SELECT COUNT(*) FROM Messages))"' | tr -d '\r')"
[ "$check_result" = "1:5:$before_messages" ]
echo "MIGRATION_CHECK_OK=$check_result"
cleanup_check_db

cp "$release_compose" "$production_compose"
rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend frontend || true
}
trap 'rollback; cleanup_check_db' ERR

docker compose --env-file "$env_file" -f "$production_compose" config --quiet
docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend
healthy=false
for _ in $(seq 1 75); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ] || {
  docker compose --env-file "$env_file" -f "$production_compose" logs --tail 160 backend >&2
  false
}

rating_schema="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT CONCAT((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=\"ServiceRatings\"),0x3A,(SELECT COUNT(*) FROM Settings WHERE \`key\` LIKE \"serviceRating%\"))"' | tr -d '\r')"
[ "$rating_schema" = "1:5" ]

docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ | grep -q 'index-91512f0c.js'; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ]

after_messages="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nCHANNELS=%s\nRATING_SCHEMA=%s\nBACKEND_RESTARTS=%s\nFRONTEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" "$after_channels" "$rating_schema" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-frontend-1)"
echo SERVICE_RATINGS_DEPLOY_OK
trap cleanup_check_db EXIT
