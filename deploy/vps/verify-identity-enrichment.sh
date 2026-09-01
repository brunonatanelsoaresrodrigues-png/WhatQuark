#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/whaticket
compose=(docker compose --env-file .env -f compose.yaml)

curl -fsS --max-time 5 http://127.0.0.1:3101/health
printf '\nPUBLIC_BACKEND_STATUS='
curl -sS -o /dev/null -w '%{http_code}' --max-time 10 https://api.bfontes.online/health
printf '\nPUBLIC_FRONTEND_STATUS='
curl -sS -o /dev/null -w '%{http_code}' --max-time 10 https://atendimento.bfontes.online/
printf '\n'

"${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "
    SELECT CONCAT(\"MESSAGES=\",COUNT(*)) FROM Messages;
    SELECT CONCAT(\"CHANNELS=\",GROUP_CONCAT(CONCAT(id,0x3A,status) ORDER BY id)) FROM Whatsapps;
    SELECT CONCAT(\"OPEN_ISSUES=\",COUNT(*)) FROM ContactIdentityIssues WHERE status=\"OPEN\";
    SELECT CONCAT(\"OPEN_TYPES=\",GROUP_CONCAT(CONCAT(type,0x3A,total) ORDER BY type SEPARATOR 0x2C)) FROM (SELECT type,COUNT(*) total FROM ContactIdentityIssues WHERE status=\"OPEN\" GROUP BY type) counts;
    SELECT CONCAT(\"AUTO_RECONCILED=\",COUNT(*)) FROM ContactIdentityAudits WHERE action=\"AUTO_RECONCILED\";"'

backend_id="$("${compose[@]}" ps -q backend)"
printf 'BACKEND_RESTARTS=%s\n' "$(docker inspect -f '{{.RestartCount}}' "$backend_id")"
printf 'BACKEND_STATE=%s\n' "$(docker inspect -f '{{.State.Status}}' "$backend_id")"
printf 'AI_MODEL=%s\n' "$(sed -n 's/^OPENAI_MODEL=//p' .env | tail -1)"
printf 'AI_FLAG=%s\n' "$(sed -n 's/^AI_ASSISTANT_ENABLED=//p' .env | tail -1)"
if grep -q '^OPENAI_API_KEY=.' .env; then
  echo AI_KEY_PRESENT=true
else
  echo AI_KEY_PRESENT=false
fi

error_count="$("${compose[@]}" logs --since 10m backend 2>&1 | grep -Eic 'unhandled|uncaught|fatal' || true)"
printf 'BACKEND_FATAL_LOGS=%s\n' "$error_count"
