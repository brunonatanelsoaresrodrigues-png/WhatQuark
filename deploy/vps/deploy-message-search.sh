#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
production_compose="$stack_dir/compose.yaml"
release_compose="$release_dir/deploy/vps/compose.production.current.yaml"
env_file="$stack_dir/.env"
overlay=/tmp/release-message-search-20260831-1600.tar.gz
backend_image=whaticket-backend:message-search-20260831-1600
frontend_image=whaticket-frontend:message-search-20260831-1600
check_db=whaticket_message_search_check
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose_backup="$stack_dir/compose.before-message-search-$stamp.yaml"

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "${OVERLAY_SHA256:?Missing OVERLAY_SHA256}" ]
tar -xzf "$overlay" -C "$release_dir"

cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:service-ratings-20260831-1500 \
  --build-arg SOURCE_REVISION=message-search-20260831-1600 \
  -t "$backend_image" .
docker build -f deploy/vps/frontend.Dockerfile \
  --build-arg FRONTEND_BASE_IMAGE=whaticket-frontend:service-ratings-20260831-1500 \
  --build-arg SOURCE_REVISION=message-search-20260831-1600 \
  -t "$frontend_image" .
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  "$backend_image" -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$production_compose")
before_messages="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
before_channels="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"

/usr/local/sbin/whaticket-backup
latest_backup="$(ls -1t /var/backups/whaticket/database-*.sql.gz | head -1)"
gzip -t "$latest_backup"
cp "$production_compose" "$compose_backup"

cleanup_check_db() {
  cd "$stack_dir"
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_message_search_check"' \
    >/dev/null 2>&1 || true
}
trap cleanup_check_db EXIT

"${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS whaticket_message_search_check; CREATE DATABASE whaticket_message_search_check CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"'
gzip -dc "$latest_backup" | "${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" whaticket_message_search_check'

docker compose --env-file "$env_file" -f "$release_compose" config --quiet
docker compose --env-file "$env_file" -f "$release_compose" run --rm --no-deps \
  -e DB_NAME="$check_db" backend node - <<'NODE'
const { Op, fn, col, where } = require("sequelize");
const sequelize = require("./dist/database").default;
const User = require("./dist/models/User").default;
const Message = require("./dist/models/Message").default;
const search = require("./dist/services/MessageServices/SearchMessagesService").default;
const context = require("./dist/services/MessageServices/ShowMessageContextService").default;
(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { profile: "admin" }, order: [["id", "ASC"]] });
  const message = await Message.findOne({
    where: { body: { [Op.ne]: "" }, [Op.and]: [where(fn("CHAR_LENGTH", col("body")), { [Op.gte]: 10 })] },
    order: [["createdAt", "DESC"]]
  });
  if (!user || !message) throw new Error("SEARCH_PREFLIGHT_FIXTURE_MISSING");
  const term = String(message.body).trim().slice(0, 6);
  const started = Date.now();
  const results = await search({ ticketId: String(message.ticketId), userId: String(user.id), query: term });
  const surroundings = await context({ ticketId: String(message.ticketId), messageId: message.id, userId: String(user.id) });
  if (!results.count || !results.results.some(item => item.id === message.id)) throw new Error("SEARCH_PREFLIGHT_RESULT_MISSING");
  if (surroundings.targetMessageId !== message.id) throw new Error("SEARCH_PREFLIGHT_CONTEXT_MISSING");
  console.log(`SEARCH_PREFLIGHT_OK=${results.count}:${surroundings.messages.length}:${Date.now() - started}ms`);
  await sequelize.close();
})().catch(async error => {
  console.error(error);
  await sequelize.close().catch(() => undefined);
  process.exit(1);
});
NODE
cleanup_check_db

cp "$release_compose" "$production_compose"
rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  cp "$compose_backup" "$production_compose"
  cd "$stack_dir"
  docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps backend frontend || true
}
trap 'rollback; cleanup_check_db' ERR

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
  docker compose --env-file "$env_file" -f "$production_compose" logs --tail 160 backend >&2
  false
}

docker compose --env-file "$env_file" -f "$production_compose" up -d --no-deps frontend
frontend_healthy=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/ | grep -q 'index-7255c7bb.js'; then
    frontend_healthy=true
    break
  fi
  sleep 1
done
[ "$frontend_healthy" = true ]

after_messages="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"
after_channels="$(docker compose --env-file "$env_file" -f "$production_compose" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
[ "$after_messages" -ge "$before_messages" ]
[ "$after_channels" = "$before_channels" ]

printf 'BACKUP=%s\nMESSAGES_BEFORE=%s\nMESSAGES_AFTER=%s\nCHANNELS=%s\nBACKEND_RESTARTS=%s\nFRONTEND_RESTARTS=%s\n' \
  "$latest_backup" "$before_messages" "$after_messages" "$after_channels" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)" \
  "$(docker inspect -f '{{.RestartCount}}' whaticket-frontend-1)"
echo MESSAGE_SEARCH_DEPLOY_OK
trap cleanup_check_db EXIT
