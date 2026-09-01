const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/quarkClinicErrors.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const { isQuarkPatientAmbiguous, isQuarkPatientNotFound } = loaded.exports;

test("treats an absent Quark patient as an expected empty state", () => {
  assert.equal(
    isQuarkPatientNotFound({
      response: {
        status: 404,
        data: { error: "ERR_QUARK_PATIENT_NOT_FOUND" },
      },
    }),
    true
  );
});

test("keeps service and permission failures as real errors", () => {
  assert.equal(isQuarkPatientNotFound({ response: { status: 503 } }), false);
  assert.equal(
    isQuarkPatientNotFound({
      response: { status: 404, data: { error: "ERR_NO_CONTACT_FOUND" } },
    }),
    false
  );
});

test("identifies an ambiguous Quark patient without treating it as absent", () => {
  const error = {
    response: {
      status: 409,
      data: { error: "ERR_QUARK_PATIENT_AMBIGUOUS" },
    },
  };
  assert.equal(isQuarkPatientAmbiguous(error), true);
  assert.equal(isQuarkPatientNotFound(error), false);
});
