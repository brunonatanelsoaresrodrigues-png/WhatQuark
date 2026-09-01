#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-quark-phone-variants-20260831-1830.tar.gz
backend_image=whaticket-backend:quark-phone-variants-20260831-1830
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-quark-phone-variants-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:quark-same-day-20260831-1815 \
  --build-arg SOURCE_REVISION=quark-phone-variants-20260831-1830 \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const worker = fs.readFileSync("dist/services/QuarkClinicServices/QuarkNotificationWorker.js", "utf8");
const policy = fs.readFileSync("dist/services/MessagingServices/policy.js", "utf8");
const sender = fs.readFileSync("dist/services/QuarkClinicServices/SendQuarkWhatsAppMessage.js", "utf8");
const templates = fs.readFileSync("dist/services/QuarkClinicServices/messageTemplates.js", "utf8");
if (!worker.includes("allowSameDayRescheduledAppointment")) process.exit(1);
if (!worker.includes("allowAppointmentPhoneVariants")) process.exit(1);
if (!policy.includes("AGUARDANDO_ATENDIMENTO")) process.exit(1);
if (!sender.includes("quarkPhoneVariants")) process.exit(1);
if (!templates.includes("agendamento de hoje")) process.exit(1);
console.log("QUARK_PHONE_VARIANTS_IMAGE_OK");'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
db_scalar() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$1" | tr -d '\r'
}
before_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
before_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
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
[ "$sync_ready" = true ]

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
after_notifications="$(db_scalar 'SELECT COUNT(*) FROM QuarkAppointmentNotifications')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_notifications" -ge "$before_notifications" ]
[ "$after_channels" = "$before_channels" ]

container_config="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T backend sh -lc 'printf "%s:%s:%s:%s" "$MESSAGING_MODE" "$QUARK_INTEGRATION_ENABLED" "$QUARK_DRY_RUN" "$QUARK_REMINDER_HOURS"')"
[ "$container_config" = "production:true:false:24,2" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nNOTIFICATIONS_BEFORE=%s\nNOTIFICATIONS_AFTER=%s\nCHANNELS=%s\nCONFIG=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$before_notifications" "$after_notifications" "$after_channels" \
  "$container_config" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)"
echo QUARK_PHONE_VARIANTS_DEPLOY_OK
trap - ERR
