#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
compose_file="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
new_compose="$release_dir/deploy/vps/compose.production.current.yaml"
overlay=/tmp/backend-identity-enrichment-20260831-0400.tar.gz
old_image=whaticket-backend:identity-ops-ai-20260831-0130
new_image=whaticket-backend:identity-enrichment-20260831-0400
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-identity-enrichment-$stamp.yaml"
env_backup="$stack_dir/.env.before-identity-enrichment-$stamp"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "763039e9efde1978736646782ea11a0f8890a314de28102e5aeb121f438ff2a5" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:audit-fixes-20260830-1930 \
  --build-arg SOURCE_REVISION=identity-enrichment-20260831-0400 \
  -t "$new_image" .
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  "$new_image" -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

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
cp "$env_file" "$env_backup"
cp "$new_compose" "$compose_file"

upsert_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}
upsert_env OPENAI_MODEL gpt-5.6-luna
upsert_env IDENTITY_QUARK_ENRICHMENT_LIMIT 100
if grep -q '^OPENAI_API_KEY=.' "$env_file"; then
  upsert_env AI_ASSISTANT_ENABLED true
else
  upsert_env AI_ASSISTANT_ENABLED false
fi

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$compose_file"
  cp "$env_backup" "$env_file"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps backend || true
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

after_messages="$(docker compose --env-file "$env_file" -f "$compose_file" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$compose_file" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]
printf 'BACKUP=%s\nMESSAGES=%s\nCHANNELS=%s\nAI_MODEL_CONFIGURED=true\n' \
  "$latest_backup" "$after_messages" "$after_channels"
echo IDENTITY_ENRICHMENT_DEPLOY_OK
trap - ERR
