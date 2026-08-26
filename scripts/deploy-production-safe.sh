#!/usr/bin/env bash
set -Eeuo pipefail

stack_dir="${WHATICKET_STACK_DIR:-/opt/whaticket}"
compose_file="${WHATICKET_COMPOSE_FILE:-compose.production.yaml}"
new_backend_image="${BACKEND_IMAGE:?Set BACKEND_IMAGE to the immutable image tag}"
new_frontend_image="${FRONTEND_IMAGE:-}"
health_timeout="${WHATICKET_DEPLOY_HEALTH_TIMEOUT_SECONDS:-240}"

cd "$stack_dir"
if [[ ! -f .env || ! -f "$compose_file" ]]; then
  echo "Stack .env or compose file not found in $stack_dir" >&2
  exit 1
fi

compose=(docker compose --env-file .env -f "$compose_file")
old_backend_id="$(${compose[@]} ps -q backend)"
old_frontend_id="$(${compose[@]} ps -q frontend)"
old_backend_image="$(docker inspect --format '{{.Config.Image}}' "$old_backend_id")"
old_frontend_image="$(docker inspect --format '{{.Config.Image}}' "$old_frontend_id")"
old_provider="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$old_backend_id" | sed -n 's/^WHATSAPP_PROVIDER=//p')"

if [[ "$old_provider" != "whaileys" ]]; then
  echo "Unexpected current WhatsApp provider: $old_provider" >&2
  exit 1
fi

WHATICKET_STACK_DIR="$stack_dir" WHATICKET_COMPOSE_FILE="$compose_file" "$stack_dir/backup.sh"

wait_healthy() {
  local service="$1"
  local deadline=$((SECONDS + health_timeout))
  while (( SECONDS < deadline )); do
    local container_id health
    container_id="$(${compose[@]} ps -q "$service")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [[ "$health" == "healthy" || "$health" == "running" && "$service" == "frontend" ]]; then
      return 0
    fi
    if [[ "$health" == "unhealthy" || "$health" == "exited" || "$health" == "dead" ]]; then
      return 1
    fi
    sleep 3
  done
  return 1
}

rollback_backend() {
  echo "Backend health failed; restoring $old_backend_image" >&2
  BACKEND_IMAGE="$old_backend_image" FRONTEND_IMAGE="${new_frontend_image:-$old_frontend_image}" "${compose[@]}" up -d --no-deps backend
  wait_healthy backend
}

export BACKEND_IMAGE="$new_backend_image"
export FRONTEND_IMAGE="${new_frontend_image:-$old_frontend_image}"
"${compose[@]}" up -d --no-deps backend
if ! wait_healthy backend; then
  rollback_backend
  exit 1
fi

backend_id="$(${compose[@]} ps -q backend)"
new_provider="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$backend_id" | sed -n 's/^WHATSAPP_PROVIDER=//p')"
if [[ "$new_provider" != "$old_provider" ]]; then
  rollback_backend
  echo "WhatsApp provider changed unexpectedly; deployment rolled back" >&2
  exit 1
fi

docker exec "$backend_id" node -e "require('http').get('http://127.0.0.1:3000/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || {
  rollback_backend
  echo "Backend readiness failed; deployment rolled back" >&2
  exit 1
}

if [[ -n "$new_frontend_image" ]]; then
  "${compose[@]}" up -d --no-deps frontend
  wait_healthy frontend || {
    BACKEND_IMAGE="$new_backend_image" FRONTEND_IMAGE="$old_frontend_image" "${compose[@]}" up -d --no-deps frontend
    echo "Frontend health failed; previous frontend restored" >&2
    exit 1
  }
fi

"${compose[@]}" ps
echo "Deployment healthy. WhatsApp provider preserved: $new_provider"
