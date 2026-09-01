#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
production_compose="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
base_image=whaticket-backend:outbound-priority-20260901-1505
backend_image=whaticket-backend:attendant-quota-bypass-20260901-1555
revision=attendant-quota-bypass-20260901-1555
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-attendant-quota-bypass-$stamp.yaml"

docker image inspect "$base_image" >/dev/null
docker build -f deploy/vps/backend-attendant-quota-bypass.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE="$base_image" \
  --build-arg SOURCE_REVISION="$revision" \
  -t "$backend_image" .
docker run --rm --entrypoint node "$backend_image" -e '
const fs = require("fs");
const source = fs.readFileSync("dist/services/MessagingServices/dispatcher.js", "utf8");
if (!source.includes("policy.origin !== \"HUMAN\"")) process.exit(1);
console.log("ATTENDANT_QUOTA_BYPASS_IMAGE_OK");'

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
before_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
pending_human_before="$(db_scalar "
SELECT COUNT(*) FROM OutboundMessages
WHERE status='PENDING'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.origin'))='HUMAN';")"
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

# Release human messages postponed by the previous global hourly ceiling.
released_human="$(db_scalar "
UPDATE OutboundMessages
SET dueAt=LEAST(dueAt,NOW())
WHERE status='PENDING'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.origin'))='HUMAN';
SELECT ROW_COUNT();")"
sleep 20

after_messages="$(db_scalar 'SELECT COUNT(*) FROM Messages')"
after_channels="$(db_scalar 'SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps')"
pending_human_after="$(db_scalar "
SELECT COUNT(*) FROM OutboundMessages
WHERE status='PENDING'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.options.policy.origin'))='HUMAN';")"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]

current_container="$("${compose[@]}" ps -q backend)"
[ "$(docker inspect -f '{{.Config.Image}}' "$current_container")" = "$backend_image" ]
[ "$(docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_container")" = "$revision" ]
[ "$(docker inspect -f '{{.RestartCount}}' "$current_container")" = 0 ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nPENDING_HUMAN_BEFORE=%s\nRELEASED_HUMAN=%s\nPENDING_HUMAN_AFTER=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" \
  "$pending_human_before" "$released_human" "$pending_human_after" \
  "$after_channels" "$(docker inspect -f '{{.RestartCount}}' "$current_container")"
echo ATTENDANT_QUOTA_BYPASS_DEPLOY_OK
trap - ERR
