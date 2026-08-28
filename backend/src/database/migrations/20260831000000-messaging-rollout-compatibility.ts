import { QueryInterface } from "sequelize";

module.exports = {
  up: async (query: QueryInterface) => {
    // Preserve ongoing service windows without turning imported contacts into consent.
    // Existing message dates use the Sequelize database timezone (-03:00).
    await query.sequelize.query(`
      INSERT INTO AutomationStates (id, data, createdAt, updatedAt)
      SELECT CONCAT('inbound-time:', t.whatsappId, ':', c.number),
        JSON_QUOTE(DATE_FORMAT(CONVERT_TZ(MAX(m.createdAt), '-03:00', '+00:00'), '%Y-%m-%dT%H:%i:%s.000Z')),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM Messages m JOIN Tickets t ON t.id = m.ticketId JOIN Contacts c ON c.id = t.contactId
      WHERE m.fromMe = 0 AND c.isGroup = 0 AND c.number REGEXP '^[0-9]{8,15}$'
        AND m.createdAt >= DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-03:00'), INTERVAL 24 HOUR)
      GROUP BY t.whatsappId, c.number
      ON DUPLICATE KEY UPDATE data = IF(AutomationStates.data < VALUES(data), VALUES(data), AutomationStates.data)
    `);
    // Older payloads ask for ambiguous numeric replies. Retain the ledger and require review.
    await query.sequelize.query(`
      UPDATE QuarkAppointmentNotifications
      SET status = 'SUPPRESSED', lastError = 'ERR_LEGACY_NOTICE_REVIEW_REQUIRED', workerId = NULL, processingStartedAt = NULL
      WHERE status IN ('PENDING', 'FAILED_RETRY') AND
        CASE WHEN JSON_VALID(payload) THEN JSON_EXTRACT(payload, '$.scheduleFingerprint') IS NULL ELSE TRUE END
    `);
    await query.sequelize.query(`
      UPDATE QuarkAppointmentNotifications SET status = 'UNKNOWN', lastError = 'ERR_SEND_OUTCOME_UNKNOWN', workerId = NULL, processingStartedAt = NULL
      WHERE status = 'PROCESSING'
    `);
  },
  // Keep audit history and service timestamps when rolling back application code.
  down: async () => undefined
};
