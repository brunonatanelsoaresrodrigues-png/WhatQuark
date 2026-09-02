const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/messageEditing.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const {
  canEditMessage,
  MESSAGE_EDIT_WINDOW_MS,
  MESSAGE_EDIT_MAX_LENGTH
} = loaded.exports;

const now = Date.parse("2026-09-02T15:00:00.000Z");
const editable = {
  fromMe: true,
  isDeleted: false,
  mediaType: "chat",
  origin: "HUMAN",
  sentByUserId: 7,
  createdAt: new Date(now - 60_000).toISOString()
};

test("allows a recent human text message to be edited", () => {
  assert.equal(canEditMessage(editable, now), true);
  assert.equal(MESSAGE_EDIT_MAX_LENGTH, 4096);
});

test("hides editing after the WhatsApp 15-minute window", () => {
  assert.equal(
    canEditMessage(
      {
        ...editable,
        createdAt: new Date(now - MESSAGE_EDIT_WINDOW_MS - 1).toISOString()
      },
      now
    ),
    false
  );
});

test("does not offer editing for incoming, deleted, media or automated messages", () => {
  assert.equal(canEditMessage({ ...editable, fromMe: false }, now), false);
  assert.equal(canEditMessage({ ...editable, isDeleted: true }, now), false);
  assert.equal(canEditMessage({ ...editable, mediaType: "image" }, now), false);
  assert.equal(canEditMessage({ ...editable, origin: "BOT" }, now), false);
});
