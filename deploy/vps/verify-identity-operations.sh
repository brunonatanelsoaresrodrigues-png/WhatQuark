#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/whaticket
compose=(docker compose --env-file .env -f compose.yaml)

for _ in $(seq 1 45); do
  if "${compose[@]}" logs --since 3m backend | grep -q 'Identity reconciliation completed'; then
    break
  fi
  sleep 2
done

curl -fsS --max-time 5 http://127.0.0.1:3101/health >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:3100/ >/dev/null
[ "$(curl -sS -o /dev/null -w '%{http_code}' https://api.bfontes.online/health)" = "200" ]
[ "$(curl -sS -o /dev/null -w '%{http_code}' https://atendimento.bfontes.online/)" = "200" ]
[ "$(curl -sS -o /dev/null -w '%{http_code}' https://api.bfontes.online/admin/operations/health)" = "401" ]
[ "$(curl -sS -o /dev/null -w '%{http_code}' https://api.bfontes.online/contacts/identity/issues)" = "401" ]
[ "$(curl -sS -o /dev/null -w '%{http_code}' https://api.bfontes.online/tickets/1/assistant/status)" = "401" ]

db_values="$("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM Messages; SELECT GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id) FROM Whatsapps; SELECT COUNT(*) FROM ContactIdentityIssues WHERE status=\"OPEN\"; SELECT COUNT(*) FROM ContactQuarkLinks; SELECT COUNT(*) FROM OperationalIncidents WHERE status IN (\"OPEN\",\"ACKNOWLEDGED\"); SELECT COUNT(*) FROM AiSuggestions;"' | tr -d '\r')"

echo "$db_values" | sed -n '1s/^/MESSAGES=/p;2s/^/CHANNELS=/p;3s/^/IDENTITY_OPEN=/p;4s/^/QUARK_LINKS=/p;5s/^/INCIDENTS_ACTIVE=/p;6s/^/AI_SUGGESTIONS=/p'
echo "BACKEND_IMAGE=$("${compose[@]}" images --format json backend | grep -o 'whaticket-backend:[^" ]*' | head -1)"
echo "FRONTEND_IMAGE=$("${compose[@]}" images --format json frontend | grep -o 'whaticket-frontend:[^" ]*' | head -1)"
echo "BACKEND_RESTARTS=$(docker inspect -f '{{.RestartCount}}' whaticket-backend-1)"
echo "FRONTEND_RESTARTS=$(docker inspect -f '{{.RestartCount}}' whaticket-frontend-1)"
echo "BACKUP_HEALTH=$(cat /var/backups/whaticket/health.json)"
"${compose[@]}" logs --since 5m backend | grep -E 'Identity reconciliation completed|Operational health check failed|Global uncaught|Global unhandled|Server started|Redis connected' | tail -20 || true
echo VERIFY_OK
