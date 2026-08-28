/* Run only against the disposable clone. Never initializes WhatsApp or workers. */
const assert = require("assert");
const path = require("path");
const { randomBytes } = require("crypto");
const root = process.cwd();
assert(/^whaticket_safety_\d+$/.test(process.env.DB_NAME || ""));
assert.strictEqual(process.env.MESSAGING_MODE, "simulation");
assert.strictEqual(process.env.QUARK_INTEGRATION_ENABLED, "false");
const app = require(path.join(root, "dist/app")).default;
const db = require(path.join(root, "dist/database")).default;
const User = require(path.join(root, "dist/models/User")).default;
const Ticket = require(path.join(root, "dist/models/Ticket")).default;
const Queue = require(path.join(root, "dist/models/Queue")).default;
const { initIO } = require(path.join(root, "dist/libs/socket"));
const { assertExecution } = require(path.join(root, "dist/services/MessagingServices/policy"));
const fingerprint = async () => (await db.query(`SELECT COUNT(*) AS total,
  BIT_XOR(CRC32(CONCAT_WS('|', id, ticketId, body, COALESCE(mediaUrl, '')))) AS contentHash FROM Messages`))[0][0];

(async () => {
  const before = await fingerprint();
  const ticketCount = await Ticket.count();
  const keyCount = (await db.query("SELECT COUNT(*) AS count FROM WppKeys"))[0][0].count;
  const password = randomBytes(24).toString("hex");
  const email = `deploy-${randomBytes(8).toString("hex")}@example.invalid`;
  const admin = await User.create({ name: "Staging verification", email, password, profile: "admin" });
  const server = app.listen(0, "127.0.0.1");
  initIO(server);
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.strictEqual(login.status, 200, "login");
  const { token, user } = await login.json();
  assert(token && !user.passwordHash);
  const headers = { Authorization: `Bearer ${token}` };
  const read = async route => {
    const response = await fetch(base + route, { headers });
    assert.strictEqual(response.status, 200, route);
    return response.json();
  };
  assert.strictEqual((await fetch(base + "/tickets")).status, 401, "unauthenticated access");
  const mode = await read("/messaging/status");
  assert.strictEqual(mode.mode, "simulation");
  assert.strictEqual(mode.provider, "whaileys");
  const queues = await Queue.findAll({ attributes: ["id"] });
  const ticketList = await read(`/tickets?showAll=true&queueIds=${encodeURIComponent(JSON.stringify(queues.map(q => q.id)))}`);
  assert(Array.isArray(ticketList.tickets));
  const day = new Date().toISOString().slice(0, 10);
  for (const route of ["summary", "timeseries", "breakdown", "calendar-days", "appointments"])
    await read(`/quark/dashboard/${route}?from=${day}&to=${day}`);
  await read("/users/assignees");
  const ticket = await Ticket.findOne();
  if (ticket) {
    const messages = await read(`/messages/${ticket.id}`);
    assert(Array.isArray(messages.messages));
    await read(`/tickets/${ticket.id}/context`);
  }
  await assert.rejects(() => assertExecution("5500000000000"), /ERR_MESSAGING_PAUSED/);
  await assert.rejects(() => assertExecution("5500000000000", true), /ERR_MESSAGING_PAUSED/);
  assert.deepStrictEqual(await fingerprint(), before, "message contents unchanged");
  assert.strictEqual(await Ticket.count(), ticketCount, "conversations unchanged");
  assert.strictEqual((await db.query("SELECT COUNT(*) AS count FROM WppKeys"))[0][0].count, keyCount, "WhatsApp keys unchanged");
  await admin.destroy();
  console.log(JSON.stringify({ result: "PASS", login: true, protectedRoutes: true, quarkDashboard: true, calendar: true, history: true, simulationBlocksMessaging: true, preservedMessages: before.total, preservedTickets: ticketCount, preservedKeys: keyCount }));
  server.close();
  await db.close();
  process.exit(0);
})().catch(error => { console.error("STAGING_VERIFICATION_FAILED:", error.message); process.exit(1); });
