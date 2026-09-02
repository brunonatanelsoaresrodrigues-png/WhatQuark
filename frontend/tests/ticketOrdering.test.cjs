const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/ticketOrdering.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const { sortAtAfterUnreadUpdate, sortTickets } = loaded.exports;

const tickets = [
  { id: 1, sortAt: "2026-09-02T10:00:00.000Z" },
  { id: 2, sortAt: "2026-09-02T10:10:00.000Z" },
  { id: 3, sortAt: "2026-09-02T10:05:00.000Z" }
];

test("shows the newest activity first for active and mixed conversations", () => {
  assert.deepEqual(
    sortTickets(tickets, "open").map(ticket => ticket.id),
    [2, 3, 1]
  );
  assert.deepEqual(
    sortTickets(tickets).map(ticket => ticket.id),
    [2, 3, 1]
  );
});

test("shows the patient waiting longest first in the pending queue", () => {
  assert.deepEqual(
    sortTickets(tickets, "pending").map(ticket => ticket.id),
    [1, 3, 2]
  );
});

test("keeps the input immutable and uses the ticket id as a stable tie-breaker", () => {
  const tied = [
    { id: 8, updatedAt: "2026-09-02T10:00:00.000Z" },
    { id: 4, updatedAt: "2026-09-02T10:00:00.000Z" }
  ];

  assert.deepEqual(
    sortTickets(tied, "closed").map(ticket => ticket.id),
    [8, 4]
  );
  assert.deepEqual(tied.map(ticket => ticket.id), [8, 4]);
});

test("keeps the original waiting time only while unread messages remain", () => {
  const incoming = {
    status: "pending",
    updatedAt: "2026-09-02T10:20:00.000Z"
  };

  assert.equal(
    sortAtAfterUnreadUpdate(
      {
        unreadMessages: 2,
        sortAt: "2026-09-02T10:00:00.000Z"
      },
      incoming
    ),
    "2026-09-02T10:00:00.000Z"
  );
  assert.equal(
    sortAtAfterUnreadUpdate(
      {
        unreadMessages: 0,
        sortAt: "2026-09-02T10:00:00.000Z"
      },
      incoming
    ),
    "2026-09-02T10:20:00.000Z"
  );
});
