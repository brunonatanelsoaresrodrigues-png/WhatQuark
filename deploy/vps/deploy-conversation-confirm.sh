#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-conversation-confirm-20260901-1450
production_compose="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-conversation-confirm-20260901-1450.tar.gz
backend_base=whaticket-backend:quark-quiet-resume-recovery-20260901-1435
frontend_base=whaticket-frontend:message-send-fix-20260831-1427
frontend_compose_base=whaticket-frontend:audio-player-clean-20260831-1630
backend_image=whaticket-backend:conversation-confirm-20260901-1450
frontend_image=whaticket-frontend:conversation-confirm-20260901-1450
revision=conversation-confirm-20260901-1450
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-conversation-confirm-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
mkdir -p "$release_dir"
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker image inspect "$backend_base" >/dev/null
docker image inspect "$frontend_base" >/dev/null
docker build -f deploy/vps/backend-conversation-confirm.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE="$backend_base" \
  --build-arg SOURCE_REVISION="$revision" \
  -t "$backend_image" .
docker build -f deploy/vps/frontend.Dockerfile \
  --build-arg FRONTEND_BASE_IMAGE="$frontend_base" \
  --build-arg SOURCE_REVISION="$revision" \
  -t "$frontend_image" .

docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const source = fs.readFileSync("dist/controllers/QuarkDashboardController.js", "utf8");
if (!source.includes("ensureViewAccess(req)")) process.exit(1);
if (!source.includes("ConfirmQuarkAppointmentFromDashboardService")) process.exit(1);
console.log("CONVERSATION_CONFIRM_BACKEND_IMAGE_OK");'
docker run --rm --entrypoint sh "$frontend_image" -c \
  'grep -R -q "Confirmar consulta no Quark" /usr/share/nginx/html/assets'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}

current_backend="$("${compose[@]}" ps -q backend)"
current_frontend="$("${compose[@]}" ps -q frontend)"
[ "$(docker inspect -f '{{.Config.Image}}' "$current_backend")" = "$backend_base" ]
[ "$(docker inspect -f '{{.Config.Image}}' "$current_frontend")" = "$frontend_base" ]
[ "$(grep -c "image: $backend_base" "$production_compose")" = 1 ]
[ "$(grep -c "image: $frontend_compose_base" "$production_compose")" = 1 ]

before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
before_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
old_sync_worker="$(db_scalar 'SELECT COALESCE(syncWorkerId,0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp -p "$production_compose" "$compose_backup"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp -p "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend frontend || true
}
trap rollback ERR

sed -i "s|image: $backend_base|image: $backend_image|" "$production_compose"
sed -i "s|image: $frontend_compose_base|image: $frontend_image|" "$production_compose"
"${compose[@]}" config --quiet
restart_cutoff="$(db_scalar 'SELECT DATE_FORMAT(NOW(),0x25592D256D2D25642025483A25693A2553)')"
"${compose[@]}" up -d --no-deps backend

backend_healthy=false
for _ in $(seq 1 75); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    backend_healthy=true
    break
  fi
  sleep 2
done
[ "$backend_healthy" = true ] || {
  "${compose[@]}" logs --tail 180 backend >&2
  false
}

stale_sync_locks=0
if [ "$old_sync_worker" != null ]; then
  stale_sync_locks="$(db_scalar "
UPDATE QuarkSyncStates
SET syncWorkerId=NULL,syncLockUntil=NULL
WHERE \`key\`='appointments' AND syncWorkerId='$old_sync_worker';
SELECT ROW_COUNT();")"
fi
stale_appointment_locks="$(db_scalar "
UPDATE AutomationStates
SET lockOwner=NULL,lockedUntil=NULL
WHERE id LIKE 'quark-appointment:%'
  AND lockedUntil > NOW()
  AND updatedAt <= '$restart_cutoff';
SELECT ROW_COUNT();")"

"${compose[@]}" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 45); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ | grep -q 'index-6751963d.js'; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ] || {
  "${compose[@]}" logs --tail 120 frontend >&2
  false
}
"${compose[@]}" exec -T frontend sh -lc \
  'grep -R -q "Confirmar consulta no Quark" /usr/share/nginx/html/assets'

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_notifications" -ge "$before_notifications" ]
[ "$after_channels" = "$before_channels" ]

current_backend="$("${compose[@]}" ps -q backend)"
current_frontend="$("${compose[@]}" ps -q frontend)"
[ "$(docker inspect -f '{{.Config.Image}}' "$current_backend")" = "$backend_image" ]
[ "$(docker inspect -f '{{.Config.Image}}' "$current_frontend")" = "$frontend_image" ]
[ "$(docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_backend")" = "$revision" ]
[ "$(docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_frontend")" = "$revision" ]
[ "$(docker inspect -f '{{.RestartCount}}' "$current_backend")" = 0 ]
[ "$(docker inspect -f '{{.RestartCount}}' "$current_frontend")" = 0 ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nNOTIFICATIONS_BEFORE=%s\nNOTIFICATIONS_AFTER=%s\nSTALE_SYNC_LOCKS=%s\nSTALE_APPOINTMENT_LOCKS=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\nFRONTEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_notifications" "$after_notifications" \
  "$stale_sync_locks" "$stale_appointment_locks" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' "$current_backend")" \
  "$(docker inspect -f '{{.RestartCount}}' "$current_frontend")"
echo CONVERSATION_CONFIRM_DEPLOY_OK
trap - ERR
