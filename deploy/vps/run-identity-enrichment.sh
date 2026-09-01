#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/whaticket
compose=(docker compose --env-file .env -f compose.yaml)

read -r admin_id token_version < <("${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT id,tokenVersion FROM Users WHERE profile=\"admin\" ORDER BY id LIMIT 1"' | tr -d '\r')
[ -n "$admin_id" ]

token="$("${compose[@]}" exec -T backend node - "$admin_id" "$token_version" <<'NODE'
const jwt = require("jsonwebtoken");
const id = Number(process.argv[2]);
const tokenVersion = Number(process.argv[3]);
process.stdout.write(jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "15m"
}));
NODE
)"

open_count() {
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM ContactIdentityIssues WHERE status=\"OPEN\""' | tr -d '\r'
}

before="$(open_count)"
printf 'OPEN_BEFORE=%s\n' "$before"
for batch in $(seq 1 8); do
  response="$(curl -fsS --max-time 180 -X POST \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data '{}' http://127.0.0.1:3101/contacts/identity/reconcile)"
  after="$(open_count)"
  printf 'BATCH=%s OPEN=%s RESULT=%s\n' "$batch" "$after" "$response"
  if [ "$after" -ge "$before" ]; then
    break
  fi
  before="$after"
done

"${compose[@]}" exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "
    SELECT type,severity,COUNT(*)
    FROM ContactIdentityIssues
    WHERE status=\"OPEN\"
    GROUP BY type,severity
    ORDER BY COUNT(*) DESC;
    SELECT COUNT(*) FROM Contacts WHERE isGroup=0 AND (cpf IS NULL OR cpf=\"\");"' | tr -d '\r'
echo IDENTITY_ENRICHMENT_RUN_OK
