#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-quark-quiet-resume-20260901-1405.tar.gz
base_image=whaticket-backend:quark-quiet-resume-20260901-1405
backend_image=whaticket-backend:quark-quiet-resume-recovery-20260901-1435
revision=quark-quiet-resume-recovery-20260901-1435
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-quark-quiet-resume-$stamp.yaml"
env_backup="$stack_dir/.env.before-quark-quiet-resume-$stamp"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
mkdir -p "$release_dir"
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker image inspect "$base_image" >/dev/null
docker build -f deploy/vps/backend-queue-resume.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE="$base_image" \
  --build-arg SOURCE_REVISION="$revision" \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const worker = fs.readFileSync("dist/services/QuarkClinicServices/QuarkNotificationWorker.js", "utf8");
const dispatcher = fs.readFileSync("dist/services/MessagingServices/dispatcher.js", "utf8");
if (!worker.includes("nextAttemptAt") || !worker.includes("ERR_MESSAGE_QUEUED")) process.exit(1);
if (!worker.includes("Queued Quark notification could not be reconciled")) process.exit(1);
if (!dispatcher.includes("usesGenericRecipientPacing") || !dispatcher.includes("appointmentNotice")) process.exit(1);
console.log("QUARK_QUIET_RESUME_IMAGE_OK");'

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
before_sync="$(db_scalar 'SELECT COALESCE(DATE_FORMAT(lastSuccessfulSyncAt,0x25592D256D2D25642025483A25693A2553),0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
old_sync_worker="$(db_scalar 'SELECT COALESCE(syncWorkerId,0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
before_target_sent="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
WHERE DATE(a.scheduledAt)='2026-09-02'
  AND n.status='SENT'
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint;")"

/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp -p "$production_compose" "$compose_backup"
cp -p "$env_file" "$env_backup"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp -p "$compose_backup" "$production_compose"
  cp -p "$env_backup" "$env_file"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend || true
}
trap rollback ERR

sed -i "s|image: $base_image|image: $backend_image|" "$production_compose"
set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}
set_env_value QUARK_SEND_INTERVAL_MIN_SECONDS 15
set_env_value QUARK_SEND_INTERVAL_MAX_SECONDS 45
set_env_value QUARK_MAX_MESSAGES_PER_HOUR 100

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

# A container stopped in the middle of a sync cannot release its database
# leases. Clear only leases that belonged to the stopped process or predate
# this restart; leases acquired by the new process remain untouched.
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

# Remove only notices the application itself would discard one at a time:
# expired appointments and notifications superseded by a newer ledger entry.
# Doing this in one pass prevents obsolete backlog from delaying valid notices.
expired_notices="$(db_scalar "
UPDATE QuarkAppointmentNotifications n
SET n.status='SUPPRESSED',
    n.processingStartedAt=NULL,
    n.workerId=NULL,
    n.lastError='Notification expired after the appointment time'
WHERE n.status IN ('PENDING','FAILED_RETRY')
  AND STR_TO_DATE(
        LEFT(JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.validUntil')),19),
        '%Y-%m-%dT%H:%i:%s'
      ) <= UTC_TIMESTAMP();
SELECT ROW_COUNT();")"
superseded_notices="$(db_scalar "
UPDATE QuarkAppointmentNotifications n
JOIN QuarkAppointmentNotifications newer
  ON newer.appointmentId=n.appointmentId
 AND newer.recipientPhone=n.recipientPhone
 AND newer.id>n.id
 AND newer.status IN ('PENDING','PROCESSING','FAILED_RETRY','SENT')
SET n.status='SUPPRESSED',
    n.processingStartedAt=NULL,
    n.workerId=NULL,
    n.lastError='Superseded by a newer appointment notification'
WHERE n.status IN ('PENDING','FAILED_RETRY');
SELECT ROW_COUNT();")"

sync_ready=false
for _ in $(seq 1 40); do
  current_sync="$(db_scalar 'SELECT COALESCE(DATE_FORMAT(lastSuccessfulSyncAt,0x25592D256D2D25642025483A25693A2553),0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
  if [ "$current_sync" != "$before_sync" ]; then
    sync_ready=true
    break
  fi
  sleep 5
done
[ "$sync_ready" = true ]

# Re-open only still-valid appointment notices that an earlier generic
# recipient limit placed in the future. The new dispatcher will not apply that
# limit to appointment-bound messages again.
released_pending="$(db_scalar "
UPDATE OutboundMessages
SET dueAt=NOW(),errorCode=NULL
WHERE status='PENDING'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.appointmentNotice'))='true'
  AND STR_TO_DATE(
        LEFT(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.expiresAt')),19),
        '%Y-%m-%dT%H:%i:%s'
      ) > UTC_TIMESTAMP();
SELECT ROW_COUNT();")"

probe_id="$(db_scalar "
SELECT COALESCE(id,0)
FROM QuarkAppointmentNotifications
WHERE status IN ('PENDING','FAILED_RETRY') AND nextAttemptAt<=NOW()
ORDER BY priorityAt, nextAttemptAt, createdAt
LIMIT 1;")"
probe_before="$(db_scalar "SELECT CONCAT(status,'|',DATE_FORMAT(updatedAt,'%Y-%m-%d %H:%i:%s')) FROM QuarkAppointmentNotifications WHERE id=$probe_id;")"
progress=false
for _ in $(seq 1 40); do
  current_target_sent="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
WHERE DATE(a.scheduledAt)='2026-09-02'
  AND n.status='SENT'
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint;")"
  if [ "$current_target_sent" -gt "$before_target_sent" ]; then
    progress=true
    break
  fi
  probe_now="$(db_scalar "SELECT COALESCE(CONCAT(status,'|',DATE_FORMAT(updatedAt,'%Y-%m-%d %H:%i:%s')),'missing') FROM QuarkAppointmentNotifications WHERE id=$probe_id;")"
  if [ "$probe_id" = 0 ] || [ "$probe_now" != "$probe_before" ]; then
    progress=true
    break
  fi
  sleep 3
done
[ "$progress" = true ]

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_notifications" -ge "$before_notifications" ]
[ "$after_channels" = "$before_channels" ]

current_container="$("${compose[@]}" ps -q backend)"
container_config="$("${compose[@]}" exec -T backend sh -lc 'printf "%s:%s:%s:%s:%s:%s:%s" "$MESSAGING_MODE" "$QUARK_INTEGRATION_ENABLED" "$QUARK_DRY_RUN" "$QUARK_REMINDER_HOURS" "$QUARK_SEND_INTERVAL_MIN_SECONDS" "$QUARK_SEND_INTERVAL_MAX_SECONDS" "$QUARK_MAX_MESSAGES_PER_HOUR"')"
[ "$container_config" = "production:true:false:24,2:15:45:100" ]
[ "$(docker inspect -f '{{.Config.Image}}' "$current_container")" = "$backend_image" ]
[ "$(docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_container")" = "$revision" ]

restart_count="$(docker inspect -f '{{.RestartCount}}' "$current_container")"
[ "$restart_count" = 0 ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nNOTIFICATIONS_BEFORE=%s\nNOTIFICATIONS_AFTER=%s\nSTALE_SYNC_LOCKS=%s\nSTALE_APPOINTMENT_LOCKS=%s\nEXPIRED_NOTICES=%s\nSUPERSEDED_NOTICES=%s\nRELEASED_PENDING=%s\nTARGET_SENT_BEFORE=%s\nTARGET_SENT_NOW=%s\nCHANNELS=%s\nCONFIG=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_notifications" "$after_notifications" "$stale_sync_locks" \
  "$stale_appointment_locks" "$expired_notices" "$superseded_notices" \
  "$released_pending" "$before_target_sent" "$current_target_sent" \
  "$after_channels" "$container_config" "$restart_count"
echo QUARK_QUIET_RESUME_DEPLOY_OK
trap - ERR
