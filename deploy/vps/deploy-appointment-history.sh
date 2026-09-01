#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-appointment-history-20260831-1700.tar.gz
backend_image=whaticket-backend:appointment-history-20260831-1700
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-appointment-history-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:message-search-20260831-1600 \
  --build-arg SOURCE_REVISION=appointment-history-20260831-1700 \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const sync = fs.readFileSync("dist/services/QuarkClinicServices/SyncQuarkAppointmentsService.js", "utf8");
const config = fs.readFileSync("dist/services/QuarkClinicServices/config.js", "utf8");
if (!sync.includes("syncLookbackDays") || !config.includes("QUARK_SYNC_LOOKBACK_DAYS")) process.exit(1);
console.log("APPOINTMENT_HISTORY_IMAGE_OK");'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}
before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_appointments="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointments')"
before_historical="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointments WHERE scheduledAt < NOW()')"
before_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"

/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp "$production_compose" "$compose_backup"
cp "$release_compose" "$production_compose"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend || true
}
trap rollback ERR

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
  docker compose --env-file "$env_file" -f "$production_compose" logs --tail 180 backend >&2
  false
}

sync_ready=false
for _ in $(seq 1 90); do
  sync_state="$(db_scalar 'SELECT CONCAT(status,0x3A,fingerprintVersion) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
  if [ "$sync_state" = "ACTIVE:5" ]; then
    sync_ready=true
    break
  fi
  sleep 10
done
[ "$sync_ready" = true ] || {
  docker compose --env-file "$env_file" -f "$production_compose" logs --tail 220 backend >&2
  false
}

channel_ready=false
for _ in $(seq 1 60); do
  current_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
  if [ "$current_channels" = "$before_channels" ]; then
    channel_ready=true
    break
  fi
  sleep 2
done
[ "$channel_ready" = true ]

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_appointments="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointments')"
after_historical="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointments WHERE scheduledAt < NOW()')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_appointments" -ge "$before_appointments" ]
[ "$after_historical" -ge "$before_historical" ]
[ "$after_channels" = "$before_channels" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nAPPOINTMENTS_BEFORE=%s\nAPPOINTMENTS_AFTER=%s\nHISTORICAL_BEFORE=%s\nHISTORICAL_AFTER=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_appointments" "$after_appointments" \
  "$before_historical" "$after_historical" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)"
echo APPOINTMENT_HISTORY_DEPLOY_OK
trap - ERR
