#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-quark-reminder-dedupe-20260831-2040.tar.gz
backend_image=whaticket-backend:quark-reminder-dedupe-20260831-2040
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-quark-reminder-dedupe-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:quark-reminder-reliability-20260831-2025 \
  --build-arg SOURCE_REVISION=quark-reminder-dedupe-20260831-2040 \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const sync = fs.readFileSync("dist/services/QuarkClinicServices/SyncQuarkAppointmentsService.js", "utf8");
const worker = fs.readFileSync("dist/services/QuarkClinicServices/QuarkNotificationWorker.js", "utf8");
const inbound = fs.readFileSync("dist/services/MessagingServices/HandleInboundAutomation.js", "utf8");
const reply = fs.readFileSync("dist/services/QuarkClinicServices/HandleQuarkConfirmationReply.js", "utf8");
const apply = fs.readFileSync("dist/services/QuarkClinicServices/ApplyQuarkDecision.js", "utf8");
const tickets = fs.readFileSync("dist/services/TicketServices/FindOrCreateTicketService.js", "utf8");
const manual = fs.readFileSync("dist/services/QuarkClinicServices/EnqueueManualQuarkReminderService.js", "utf8");
if (!sync.includes("MANUAL_REMINDER") || !sync.includes("reminder && !baseline")) process.exit(1);
if (!worker.includes("DEAD_LETTER") || !worker.includes("ERR_LOCAL_PERSISTENCE_PENDING")) process.exit(1);
if (!inbound.includes("appointmentReply") || !inbound.includes("botPaused || !!appointmentReply")) process.exit(1);
if (!reply.includes("allowPausedBot")) process.exit(1);
if (!apply.includes("quarkPhoneVariants")) process.exit(1);
if (!tickets.includes("bot-pause:") || !tickets.includes("intake-attempts:")) process.exit(1);
if (!manual.includes("existingAutomatic") || !manual.includes("MANUAL_REMINDER")) process.exit(1);
console.log("QUARK_REMINDER_RELIABILITY_IMAGE_OK");'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}
before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
before_notification_id="$(db_scalar 'SELECT COALESCE(MAX(id),0) FROM QuarkAppointmentNotifications')"
before_sync="$(db_scalar 'SELECT COALESCE(DATE_FORMAT(lastSuccessfulSyncAt,0x25592D256D2D25642025483A25693A2553),0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
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
for _ in $(seq 1 40); do
  current_sync="$(db_scalar 'SELECT COALESCE(DATE_FORMAT(lastSuccessfulSyncAt,0x25592D256D2D25642025483A25693A2553),0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
  if [ "$current_sync" != "$before_sync" ]; then
    sync_ready=true
    break
  fi
  sleep 5
done
[ "$sync_ready" = true ]

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
duplicate_new="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
WHERE n.id > $before_notification_id
  AND n.eventType='REMINDER'
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  AND EXISTS (
    SELECT 1 FROM QuarkAppointmentNotifications m
    WHERE m.appointmentId=a.appointmentId
      AND m.recipientPhone=n.recipientPhone
      AND m.eventType='MANUAL_REMINDER'
      AND m.status IN ('PENDING','PROCESSING','FAILED_RETRY','SENT','UNKNOWN')
      AND JSON_UNQUOTE(JSON_EXTRACT(m.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  )")"

[ "$after_messages" -ge "$before_messages" ]
[ "$after_notifications" -ge "$before_notifications" ]
[ "$after_channels" = "$before_channels" ]
[ "$duplicate_new" = 0 ]

ambiguous_fixed="$(db_scalar "
UPDATE QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId=n.appointmentId
SET n.status='UNKNOWN'
WHERE n.status='SUPPRESSED'
  AND n.lastError='ERR_LOCAL_PERSISTENCE_PENDING'
  AND n.eventType IN ('REMINDER','MANUAL_REMINDER')
  AND a.scheduledAt >= CURDATE() + INTERVAL 1 DAY
  AND a.scheduledAt < CURDATE() + INTERVAL 2 DAY
  AND JSON_UNQUOTE(JSON_EXTRACT(n.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint;
SELECT ROW_COUNT();")"

duplicates_suppressed="$(db_scalar "
UPDATE QuarkAppointmentNotifications m
JOIN QuarkAppointments a ON a.appointmentId=m.appointmentId
SET m.status='SUPPRESSED',m.lastError='Equivalent automatic reminder already sent'
WHERE m.eventType='MANUAL_REMINDER'
  AND m.status IN ('PENDING','FAILED_RETRY')
  AND a.scheduledAt >= CURDATE() + INTERVAL 1 DAY
  AND a.scheduledAt < CURDATE() + INTERVAL 2 DAY
  AND JSON_UNQUOTE(JSON_EXTRACT(m.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  AND EXISTS (
    SELECT 1 FROM QuarkAppointmentNotifications r
    WHERE r.appointmentId=m.appointmentId
      AND r.recipientPhone=m.recipientPhone
      AND r.eventType='REMINDER'
      AND r.status='SENT'
      AND JSON_UNQUOTE(JSON_EXTRACT(r.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  );
SELECT ROW_COUNT();")"
remaining_duplicates="$(db_scalar "
SELECT COUNT(*)
FROM QuarkAppointmentNotifications m
JOIN QuarkAppointments a ON a.appointmentId=m.appointmentId
WHERE m.eventType='MANUAL_REMINDER'
  AND m.status IN ('PENDING','PROCESSING','FAILED_RETRY')
  AND a.scheduledAt >= CURDATE() + INTERVAL 1 DAY
  AND a.scheduledAt < CURDATE() + INTERVAL 2 DAY
  AND JSON_UNQUOTE(JSON_EXTRACT(m.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  AND EXISTS (
    SELECT 1 FROM QuarkAppointmentNotifications r
    WHERE r.appointmentId=m.appointmentId
      AND r.recipientPhone=m.recipientPhone
      AND r.eventType='REMINDER'
      AND r.status='SENT'
      AND JSON_UNQUOTE(JSON_EXTRACT(r.payload,'$.scheduleFingerprint'))=a.scheduleFingerprint
  )")"
[ "$remaining_duplicates" = 0 ]

container_config="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T backend sh -lc 'printf "%s:%s:%s:%s" "$MESSAGING_MODE" "$QUARK_INTEGRATION_ENABLED" "$QUARK_DRY_RUN" "$QUARK_REMINDER_HOURS"')"
[ "$container_config" = "production:true:false:24,2" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nNOTIFICATIONS_BEFORE=%s\nNOTIFICATIONS_AFTER=%s\nDUPLICATE_NEW=%s\nAMBIGUOUS_MARKED_UNKNOWN=%s\nDUPLICATES_SUPPRESSED=%s\nREMAINING_DUPLICATES=%s\nCHANNELS=%s\nCONFIG=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_notifications" "$after_notifications" "$duplicate_new" \
  "$ambiguous_fixed" "$duplicates_suppressed" "$remaining_duplicates" \
  "$after_channels" "$container_config" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)"
echo QUARK_REMINDER_RELIABILITY_DEPLOY_OK
trap - ERR
