#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir=/opt/whaticket
release_dir=/tmp/squadchat-release-20260831-0130
compose_file="$stack_dir/compose.yaml"
env_file="$stack_dir/.env"
image=whaticket-backend:identity-ops-ai-20260831-0130
stable=whaticket-backend:identity-ops-ai-20260831-0130-before-followup
overlay=/tmp/backend-followup-20260831-0250.tar.gz

[ "$(sha256sum "$overlay" | cut -d' ' -f1)" = "bdbbea576820230a1bbfa4ae995489d4778d2cc507db09465a7afdcb5081e9db" ]
docker image tag "$image" "$stable"
tar -xzf "$overlay" -C "$release_dir"
cd "$release_dir"
docker build -f deploy/vps/backend.Dockerfile \
  --build-arg BACKEND_BASE_IMAGE=whaticket-backend:audit-fixes-20260830-1930 \
  --build-arg SOURCE_REVISION=identity-ops-ai-20260831-0250 \
  -t "$image" .
docker run --rm --entrypoint node \
  -e DB_DIALECT=mysql -e DB_HOST=127.0.0.1 -e DB_USER=unused -e DB_PASS=unused -e DB_NAME=unused \
  "$image" -e 'require("./dist/database").default; console.log("IMAGE_MODEL_BOOT_OK")'

cd "$stack_dir"
compose=(docker compose --env-file "$env_file" -f "$compose_file")
before_messages="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages"' | tr -d '\r')"

rollback() {
  echo DEPLOY_ROLLBACK_STARTED >&2
  docker image tag "$stable" "$image"
  "${compose[@]}" up -d --no-deps backend || true
}
trap rollback ERR

"${compose[@]}" up -d --no-deps backend
healthy=false
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3101/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ]

after_values="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages; SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps"' | tr -d '\r')"
after_messages="$(printf '%s\n' "$after_values" | sed -n '1p')"
channels="$(printf '%s\n' "$after_values" | sed -n '2p')"
[ "$after_messages" -ge "$before_messages" ]
printf 'MESSAGES=%s\nCHANNELS=%s\n' "$after_messages" "$channels"
echo FOLLOWUP_DEPLOY_OK
trap - ERR
