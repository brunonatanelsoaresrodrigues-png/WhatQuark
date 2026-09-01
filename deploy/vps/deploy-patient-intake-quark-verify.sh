#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-quark-full-audit-20260901-1105.tar.gz
backend_image=whaticket-backend:quark-full-audit-20260901-1105
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-patient-intake-quark-verify-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:quark-reminder-dedupe-20260831-2040 \
  --build-arg SOURCE_REVISION=quark-full-audit-20260901-1105 \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const client = fs.readFileSync("dist/services/QuarkClinicServices/QuarkClinicClient.js", "utf8");
const sync = fs.readFileSync("dist/services/QuarkClinicServices/SyncQuarkAppointmentsService.js", "utf8");
const intake = fs.readFileSync("dist/services/PatientIntakeServices/PatientIntakeService.js", "utf8");
const messages = fs.readFileSync("dist/services/PatientIntakeServices/messages.js", "utf8");
const availability = fs.readFileSync("dist/services/PatientIntakeServices/QuarkAvailabilityService.js", "utf8");
const inbound = fs.readFileSync("dist/services/MessagingServices/HandleInboundAutomation.js", "utf8");
const worker = fs.readFileSync("dist/services/QuarkClinicServices/QuarkNotificationWorker.js", "utf8");
if (!client.includes("verified.statusMarcacao")) process.exit(1);
if (!client.includes("QUARK_BOOKING_OUTCOME_UNKNOWN")) process.exit(1);
if (!sync.includes("Known Quark appointment missing from sweep")) process.exit(1);
if (!sync.includes("Stale Quark operation reconciled from authoritative status")) process.exit(1);
if (!intake.includes("AWAITING_COVERAGE_INFO") || !intake.includes("QUARK_APPOINTMENT_CANCELLED")) process.exit(1);
if (!messages.includes("R$ 350,00") || !messages.includes("R$ 450,00")) process.exit(1);
if (!availability.includes("clinicTime_1.clinicDay")) process.exit(1);
if (!inbound.includes("abandonedProcessing")) process.exit(1);
if (!worker.includes("quarkPhoneVariants")) process.exit(1);
console.log("PATIENT_INTAKE_QUARK_VERIFY_IMAGE_OK");'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}
before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_responses="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentResponses')"
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
for _ in $(seq 1 60); do
  current_sync="$(db_scalar 'SELECT COALESCE(DATE_FORMAT(lastSuccessfulSyncAt,0x25592D256D2D25642025483A25693A2553),0x6E756C6C) FROM QuarkSyncStates WHERE `key`=0x6170706F696E746D656E7473 LIMIT 1')"
  if [ "$current_sync" != "$before_sync" ]; then
    sync_ready=true
    break
  fi
  sleep 5
done
[ "$sync_ready" = true ]

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_responses="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentResponses')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
container_config="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T backend sh -lc 'printf "%s:%s:%s:%s" "$MESSAGING_MODE" "$QUARK_INTEGRATION_ENABLED" "$QUARK_DRY_RUN" "$PATIENT_INTAKE_QUARK_BOOKING_ENABLED"')"
image_revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' whaticket-backend-1)"

[ "$after_messages" -ge "$before_messages" ]
[ "$after_responses" -ge "$before_responses" ]
[ "$after_channels" = "$before_channels" ]
[ "$container_config" = "production:true:false:true" ]
[ "$image_revision" = "quark-full-audit-20260901-1105" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nRESPONSES_BEFORE=%s\nRESPONSES_AFTER=%s\nCHANNELS=%s\nCONFIG=%s\nIMAGE_REVISION=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_responses" "$after_responses" "$after_channels" \
  "$container_config" "$image_revision" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)"
echo PATIENT_INTAKE_QUARK_VERIFY_DEPLOY_OK
trap - ERR
