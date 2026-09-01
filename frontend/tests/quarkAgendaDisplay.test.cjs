const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [
    path.join(__dirname, "../src/services/quarkAgendaDisplay.js")
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const display = loaded.exports;

test("builds the full local calendar month", () => {
  assert.deepEqual(display.quarkMonthRange(new Date(2026, 7, 29, 12)), {
    from: "2026-08-01",
    to: "2026-08-31"
  });
});

test("formats Brazilian mobile and landline numbers", () => {
  assert.equal(
    display.formatQuarkPhone("5585998765432"),
    "+55 (85) 99876-5432"
  );
  assert.equal(
    display.formatQuarkPhone("558532165432"),
    "+55 (85) 3216-5432"
  );
  assert.equal(display.formatQuarkPhone(""), "Sem telefone");
});
