#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
compose_file="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
new_compose="$release_dir/deploy/vps/compose.production.current.yaml"
overlay=/tmp/release-unofficial-consent-emoji-20260831-1100.tar.gz
backend_image=whaticket-backend:unofficial-consent-policy-20260831-1100
frontend_image=whaticket-frontend:emoji-picker-20260831-1100
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-unofficial-consent-emoji-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "1bd64ec6fa11d51b7e6537d8dc15df171cd12ccbaf3a56d9af1925e511a405e7" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:audit-fixes-20260830-1930 \
  --build-arg SOURCE_REVISION=unofficial-consent-policy-20260831-1100 \
  -t "$backend_image" .
docker build -f deploy/vps/frontend.Dockerfile \
  --build-arg FRONTEND_BASE_IMAGE=whaticket-frontend:identity-ops-ai-20260831-0130 \
  --build-arg SOURCE_REVISION=emoji-picker-20260831-1100 \
  -t "$frontend_image" .
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  "$backend_image" -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$compose_file")
before_messages="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
before_channels="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp "$compose_file" "$compose_backup"
cp "$new_compose" "$compose_file"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$compose_file"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps backend frontend || true
}
trap rollback ERR

docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps backend
healthy=false
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ]
docker compose --env-file "$env_file" -f "$compose_file" exec -T backend sh -lc \
  '[ "${WHATSAPP_PROVIDER:-wwebjs}" != "cloud" ]'

docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ | grep -q 'index-27511996.js'; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ]

after_messages="$(docker compose --env-file "$env_file" -f "$compose_file" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$compose_file" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]
printf 'BACKUP=%s\nMESSAGES=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\nFRONTEND_RESTARTS=%s\n' \
  "$latest_backup" "$after_messages" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-frontend-1)"
echo UNOFFICIAL_CONSENT_EMOJI_DEPLOY_OK
trap - ERR
