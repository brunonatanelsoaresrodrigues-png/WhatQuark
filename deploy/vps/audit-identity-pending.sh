#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/whaticket

docker compose --env-file .env -f compose.yaml exec -T mariadb sh -lc \
  'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" <<"SQL"
SELECT "BY_TYPE", type, severity, COUNT(*)
FROM ContactIdentityIssues
WHERE status="OPEN"
GROUP BY type,severity
ORDER BY COUNT(*) DESC;

SELECT "BY_LINK", i.type, COALESCE(l.status,"NO_LINK"), COUNT(*)
FROM ContactIdentityIssues i
LEFT JOIN ContactQuarkLinks l ON l.contactId=i.contactId
WHERE i.status="OPEN"
GROUP BY i.type,COALESCE(l.status,"NO_LINK")
ORDER BY i.type,COUNT(*) DESC;

SELECT "CONTACT_STATE",
  SUM(c.cpf IS NULL OR c.cpf="") AS withoutCpf,
  SUM(c.name="Contato WhatsApp") AS genericName,
  SUM(c.name REGEXP "^[0-9]{8,}$") AS numericName,
  SUM(c.number=c.lid OR CONCAT(c.number,"@lid")=c.lid) AS unresolvedLid
FROM Contacts c
WHERE c.isGroup=0;

SELECT "QUARK_DATA",
  COUNT(DISTINCT patientId) AS patients,
  SUM(snapshot LIKE "%cpf%") AS snapshotsMentioningCpf,
  SUM(phone IS NOT NULL AND phone<>"") AS withPhone
FROM QuarkAppointments;

SELECT "RECENT_AUDIT", action, COUNT(*)
FROM ContactIdentityAudits
GROUP BY action
ORDER BY COUNT(*) DESC;
SQL'
