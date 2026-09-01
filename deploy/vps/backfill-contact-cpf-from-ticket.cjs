/* One-ticket repair. The CPF is read locally, never printed, and existing values win. */
const assert = require("assert");
const path = require("path");

const root = process.cwd();
const ticketId = String(process.argv[2] || "");
assert(/^\d+$/.test(ticketId), "A numeric ticket id is required");
assert.strictEqual(process.env.DB_NAME, "whaticket");

const db = require(path.join(root, "dist/database")).default;
const query = async (sql, replacements = []) =>
  (await db.query(sql, { replacements }))[0];

const isValidCpf = value => {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = length => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};

const cpfFrom = body => {
  const candidates = String(body || "").match(/(?:\d[.\s-]?){10}\d/g) || [];
  return (
    candidates
      .map(value => value.replace(/\D/g, ""))
      .find(isValidCpf) || null
  );
};

(async () => {
  const [ticket] = await query(
    `SELECT t.id, t.contactId, c.cpf
       FROM Tickets t
       INNER JOIN Contacts c ON c.id = t.contactId
      WHERE t.id = ?
      LIMIT 1`,
    [ticketId]
  );
  assert(ticket, "Ticket not found");
  if (ticket.cpf) {
    console.log(JSON.stringify({ result: "ALREADY_SET", ticketId }));
    return;
  }

  const messages = await query(
    `SELECT body
       FROM Messages
      WHERE ticketId = ? AND fromMe = 0 AND body IS NOT NULL
      ORDER BY createdAt DESC
      LIMIT 100`,
    [ticketId]
  );
  const cpf = messages.map(message => cpfFrom(message.body)).find(Boolean);
  assert(cpf, "No validated CPF found in incoming ticket messages");

  const [, metadata] = await db.query(
    `UPDATE Contacts
        SET cpf = ?
      WHERE id = ? AND (cpf IS NULL OR cpf = '')`,
    { replacements: [cpf, ticket.contactId] }
  );
  const changed = Number(metadata) || Number(metadata?.affectedRows) || 0;
  assert.strictEqual(changed, 1, "Contact was not updated");

  const [verified] = await query(
    "SELECT LENGTH(cpf) AS cpfLength FROM Contacts WHERE id = ? LIMIT 1",
    [ticket.contactId]
  );
  assert.strictEqual(Number(verified?.cpfLength), 11, "Stored CPF is invalid");
  console.log(JSON.stringify({ result: "UPDATED", ticketId }));
})()
  .catch(error => {
    console.error("CPF_BACKFILL_FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
