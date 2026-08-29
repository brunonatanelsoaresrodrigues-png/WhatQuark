/* Read-only audit. Tokens and message/session contents are never printed. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = process.cwd();
assert.strictEqual(process.env.DB_NAME, "whaticket");
const db = require(path.join(root, "dist/database")).default;
const query = async sql => (await db.query(sql))[0];
const messages = () => query(`SELECT id, SHA2(CONCAT_WS('|', ticketId, body, COALESCE(mediaUrl, '')), 256) AS digest FROM Messages`);
const ids = table => query(`SELECT id FROM ${table}`);

(async () => {
  const [operation, file] = process.argv.slice(2);
  assert(["snapshot", "verify"].includes(operation));
  assert(file && path.isAbsolute(file));
  const current = {
    messages: await messages(),
    tickets: await ids("Tickets"),
    contacts: await ids("Contacts"),
    capturedAt: new Date().toISOString()
  };
  if (operation === "snapshot") {
    fs.writeFileSync(file, JSON.stringify(current), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ snapshot: "PASS", messages: current.messages.length, tickets: current.tickets.length, contacts: current.contacts.length }));
  } else {
    const before = JSON.parse(fs.readFileSync(file, "utf8"));
    const currentMessages = new Map(current.messages.map(row => [String(row.id), row.digest]));
    assert(before.messages.every(row => currentMessages.get(String(row.id)) === row.digest), "Existing message content changed or missing");
    for (const key of ["tickets", "contacts"]) {
      const present = new Set(current[key].map(row => String(row.id)));
      assert(before[key].every(row => present.has(String(row.id))), `Missing ${key}`);
    }
    const [admin] = await query("SELECT id, name, profile, tokenVersion FROM Users WHERE profile = 'admin' ORDER BY id LIMIT 1");
    assert(admin, "Admin required for authenticated read-only verification");
    const { createAccessToken } = require(path.join(root, "dist/helpers/CreateTokens"));
    const token = createAccessToken(admin);
    const read = async route => {
      const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}${route}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.strictEqual(response.status, 200, route);
      return response.json();
    };
    assert.strictEqual((await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/tickets`)).status, 401);
    const mode = await read("/messaging/status");
    assert.strictEqual(mode.provider, "whaileys");
    assert.strictEqual(mode.mode, "production");
    const queues = await ids("Queues");
    await read(`/tickets?showAll=true&queueIds=${encodeURIComponent(JSON.stringify(queues.map(row => row.id)))}`);
    await read("/users/assignees");
    const day = new Date().toISOString().slice(0, 10);
    for (const route of ["summary", "timeseries", "breakdown", "calendar-days", "appointments"])
      await read(`/quark/dashboard/${route}?from=${day}&to=${day}`);
    const [appointment] = await query("SELECT appointmentId FROM QuarkAppointments WHERE scheduledAt >= NOW() AND status NOT IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO') ORDER BY lastSeenAt DESC LIMIT 1");
    assert(appointment, "Synced Quark appointment required");
    const appointmentDetail = await read(`/quark/clinic/appointments/${encodeURIComponent(appointment.appointmentId)}`);
    assert.strictEqual(String(appointmentDetail.appointmentId), String(appointment.appointmentId));
    const channels = await query("SELECT id, status, LENGTH(session) AS sessionLength, LENGTH(COALESCE(qrcode, '')) AS qrLength FROM Whatsapps");
    assert(channels.some(row => row.id === 1 && row.status === "CONNECTED" && row.sessionLength > 0 && row.qrLength === 0), "WhatsApp not reconnected");
    console.log(JSON.stringify({ result: "PASS", authenticatedAPI: true, preservedMessageContents: before.messages.length, currentMessages: current.messages.length, preservedTickets: before.tickets.length, currentTickets: current.tickets.length, preservedContacts: before.contacts.length, provider: mode.provider, mode: mode.mode, channels }));
  }
  await db.close();
})().catch(error => { console.error("PRODUCTION_CHECK_FAILED:", error.message); process.exitCode = 1; db.close(); });
