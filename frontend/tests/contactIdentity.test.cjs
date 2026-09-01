const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/contactIdentity.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const {
  contactDisplayName,
  contactPhoneLabel,
  isUnresolvedWhatsAppIdentity
} = loaded.exports;

test("identifies a WhatsApp LID that was temporarily stored as the phone", () => {
  const contact = {
    number: "276299574685761",
    lid: "276299574685761@lid"
  };
  assert.equal(isUnresolvedWhatsAppIdentity(contact), true);
  assert.equal(contactPhoneLabel(contact), "Aguardando sincronização");
  assert.equal(
    contactDisplayName({ ...contact, name: "276299574685761" }),
    "Contato WhatsApp"
  );
  assert.equal(
    contactDisplayName({ ...contact, name: "Maria" }),
    "Maria"
  );
});

test("keeps and formats a confirmed phone number", () => {
  const contact = {
    number: "558586985185",
    lid: "276299574685761@lid"
  };
  assert.equal(isUnresolvedWhatsAppIdentity(contact), false);
  assert.equal(contactPhoneLabel(contact, value => `+${value}`), "+558586985185");
});
