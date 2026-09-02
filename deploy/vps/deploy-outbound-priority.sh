#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-outbound-priority-20260901-1505
production_compose="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-outbound-priority-20260901-1505.tar.gz
base_image=whaticket-backend:conversation-confirm-20260901-1450
backend_image=whaticket-backend:outbound-priority-20260901-1505
revision=outbound-priority-20260901-1505
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-outbound-priority-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
mkdir -p "$release_dir"
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker image inspect "$base_image" >/dev/null
docker build -f deploy/vps/backend-outbound-priority.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE="$base_image" \
  --build-arg SOURCE_REVISION="$revision" \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const source = fs.readFileSync("dist/services/MessagingServices/dispatcher.js", "utf8");
if (!source.includes("outboundPriorityFor")) process.exit(1);
if (!source.includes("appointmentNotice") || !source.includes("return 6")) process.exit(1);
console.log("OUTBOUND_PRIORITY_IMAGE_OK");'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}

current_container="$("${compose[@]}" ps -q backend)"
[ -n "$current_container" ]
[ "$(docker inspect -f '{{.Config.Image}}' "$current_container")" = "$base_image" ]
[ "$(grep -c "image: $base_image" "$production_compose")" = 1 ]

before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
before_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
before_wed_sent="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
WHERE DATE(a.scheduledAt)='2026-09-02'
  AND n.status='SENT'
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint;")"
old_sync_worker="$(db_scalar 'SELECT COALESCE(syncWorkerId,0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp -p "$production_compose" "$compose_backup"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp -p "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend || true
}
trap rollback ERR

sed -i "s|image: $base_image|image: $backend_image|" "$production_compose"
"${compose[@]}" config --quiet
restart_cutoff="$(db_scalar 'SELECT DATE_FORMAT(NOW(),0x25592D256D2D25642025483A25693A2553)')"
"${compose[@]}" up -d --no-deps backend

healthy=false
for _ in $(seq 1 75); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ] || {
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

# Existing appointment notices were created with the old generic proactive
# priority. Promote only pending appointment notices; human messages remain 10.
promoted_appointment_notices="$(db_scalar "
UPDATE OutboundMessages
SET priority=6,dueAt=LEAST(dueAt,NOW())
WHERE status='PENDING'
  AND priority<6
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.appointmentNotice'))='true'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.appointmentId')) IS NOT NULL;
SELECT ROW_COUNT();")"
invalid_pending_priorities="$(db_scalar "
SELECT COUNT(*)
FROM OutboundMessages
WHERE status='PENDING'
  AND priority<6
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.appointmentNotice'))='true'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.appointmentId')) IS NOT NULL;")"
[ "$invalid_pending_priorities" = 0 ]

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
after_wed_sent="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
WHERE DATE(a.scheduledAt)='2026-09-02'
  AND n.status='SENT'
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint;")"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_notifications" -ge "$before_notifications" ]
[ "$after_channels" = "$before_channels" ]

current_container="$("${compose[@]}" ps -q backend)"
[ "$(docker inspect -f '{{.Config.Image}}' "$current_container")" = "$backend_image" ]
[ "$(docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_container")" = "$revision" ]
[ "$(docker inspect -f '{{.RestartCount}}' "$current_container")" = 0 ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nNOTIFICATIONS_BEFORE=%s\nNOTIFICATIONS_AFTER=%s\nPROMOTED_APPOINTMENT_NOTICES=%s\nWED_SENT_BEFORE=%s\nWED_SENT_AFTER=%s\nSTALE_SYNC_LOCKS=%s\nSTALE_APPOINTMENT_LOCKS=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_notifications" "$after_notifications" \
  "$promoted_appointment_notices" "$before_wed_sent" "$after_wed_sent" \
  "$stale_sync_locks" "$stale_appointment_locks" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' "$current_container")"
echo OUTBOUND_PRIORITY_DEPLOY_OK
trap - ERR
