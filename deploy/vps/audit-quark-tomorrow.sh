#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only production audit. It prints aggregate counts only; no patient name,
# phone number or message body leaves the database.
cd /opt/whaticket
compose=(docker compose --env-file .env -f compose.yaml)
timezone="${QUARK_TIMEZONE:-America/Sao_Paulo}"
target_day="${1:-$(TZ="$timezone" date -d tomorrow +%F)}"

if [[ ! "$target_day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Usage: $0 [YYYY-MM-DD]" >&2
  exit 2
fi

start_epoch="$(TZ="$timezone" date -d "$target_day 00:00:00" +%s)"
end_epoch="$(TZ="$timezone" date -d "$target_day 00:00:00 +1 day" +%s)"
start_utc="$(date -u -d "@$start_epoch" '+%F %T')"
end_utc="$(date -u -d "@$end_epoch" '+%F %T')"

db_query() {
  local sql="$1"
  "${compose[@]}" exec -T mariadb sh -lc \
    'mariadb --batch --raw -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$1"' sh "$sql"
}

echo "TARGET_DAY=$target_day"
echo "TIMEZONE=$timezone"

db_query "
SELECT 'SYNC' AS section, status, fingerprintVersion,
       lastSuccessfulSyncAt,
       TIMESTAMPDIFF(MINUTE, lastSuccessfulSyncAt, UTC_TIMESTAMP()) AS ageMinutes
FROM QuarkSyncStates
WHERE \`key\` = 'appointments';

SELECT 'APPOINTMENTS' AS section, status, COUNT(*) AS total
FROM QuarkAppointments
WHERE scheduledAt >= '$start_utc' AND scheduledAt < '$end_utc'
GROUP BY status
ORDER BY status;

SELECT 'DELIVERY' AS section,
       COUNT(*) AS appointments,
       SUM(a.status = 'AGENDADO' AND a.scheduledAt <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)) AS remindersDue,
       SUM(EXISTS(
         SELECT 1 FROM QuarkAppointmentNotifications n
         WHERE n.appointmentId = a.appointmentId
           AND n.status = 'SENT'
           AND n.eventType <> 'CANCELLED'
           AND JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.scheduleFingerprint')) = a.scheduleFingerprint
       )) AS currentNoticeSent,
       SUM(EXISTS(
         SELECT 1 FROM QuarkAppointmentNotifications n
         WHERE n.appointmentId = a.appointmentId
           AND n.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY')
           AND JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.scheduleFingerprint')) = a.scheduleFingerprint
       )) AS currentNoticeQueued,
       SUM(EXISTS(
         SELECT 1 FROM QuarkAppointmentNotifications n
         WHERE n.appointmentId = a.appointmentId
           AND n.status IN ('DEAD_LETTER', 'UNKNOWN')
           AND JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.scheduleFingerprint')) = a.scheduleFingerprint
       )) AS currentNoticeFailed,
       SUM(NOT EXISTS(
         SELECT 1 FROM QuarkAppointmentNotifications n
         WHERE n.appointmentId = a.appointmentId
           AND JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.scheduleFingerprint')) = a.scheduleFingerprint
       )) AS withoutCurrentNotice
FROM QuarkAppointments a
WHERE a.scheduledAt >= '$start_utc' AND a.scheduledAt < '$end_utc';

SELECT 'NOTICE_ERRORS' AS section, n.status,
       COALESCE(NULLIF(n.lastError, ''), '(sem código)') AS errorCode,
       COUNT(*) AS total
FROM QuarkAppointmentNotifications n
JOIN QuarkAppointments a ON a.appointmentId = n.appointmentId
WHERE a.scheduledAt >= '$start_utc' AND a.scheduledAt < '$end_utc'
  AND n.status IN ('FAILED_RETRY', 'DEAD_LETTER', 'UNKNOWN', 'SUPPRESSED')
GROUP BY n.status, errorCode
ORDER BY n.status, total DESC;

SELECT 'OUTBOUND_ERRORS' AS section, o.status,
       COALESCE(NULLIF(o.errorCode, ''), '(sem código)') AS errorCode,
       COUNT(*) AS total
FROM OutboundMessages o
WHERE o.status IN ('PENDING', 'BLOCKED', 'FAILED', 'UNKNOWN')
  AND JSON_VALID(o.payload)
  AND JSON_UNQUOTE(JSON_EXTRACT(o.payload, '$.options.policy.appointmentId')) IN (
    SELECT appointmentId FROM QuarkAppointments
    WHERE scheduledAt >= '$start_utc' AND scheduledAt < '$end_utc'
  )
GROUP BY o.status, errorCode
ORDER BY o.status, total DESC;
"
