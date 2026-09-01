#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-audio-player-clean-20260831-1630.tar.gz
frontend_image=whaticket-frontend:audio-player-clean-20260831-1630
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-audio-player-clean-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/frontend.Dockerfile \
  --build-arg FRONTEND_BASE_IMAGE=whaticket-frontend:message-search-20260831-1600 \
  --build-arg SOURCE_REVISION=audio-player-clean-20260831-1630 \
  -t "$frontend_image" .

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
before_messages="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
before_channels="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
cp "$production_compose" "$compose_backup"
cp "$release_compose" "$production_compose"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps frontend || true
}
trap rollback ERR

docker compose --env-file "$env_file" -f "$production_compose" config --quiet
docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ | grep -q 'index-824f28aa.js'; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ]
curl -fsS --max-time 5 http://127.0.0.1:3101/health >/dev/null

after_messages="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]

printf 'MESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\nFRONTEND_RESTARTS=%s\n' \
  "$before_messages" "$after_messages" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-frontend-1)"
echo AUDIO_PLAYER_CLEAN_DEPLOY_OK
trap - ERR
