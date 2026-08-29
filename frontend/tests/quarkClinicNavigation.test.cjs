const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [
    path.join(__dirname, "../src/services/quarkClinicNavigation.js"),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const navigation = loaded.exports;

test("builds an internal Quark Clinic path for the exact appointment", () => {
  assert.equal(
    navigation.buildQuarkAppointmentPath("FE830EC3", 1153),
    "/quark-clinic?appointmentId=FE830EC3&returnTo=%2Ftickets%2F1153"
  );
});

test("builds an internal Quark Clinic path for the patient registration", () => {
  assert.equal(
    navigation.buildQuarkPatientPath("7001", 1153),
    "/quark-clinic?patientId=7001&returnTo=%2Ftickets%2F1153"
  );
});

test("only accepts ticket routes as return destinations", () => {
  assert.equal(
    navigation.safeQuarkReturnPath("/tickets/1153"),
    "/tickets/1153"
  );
  assert.equal(navigation.safeQuarkReturnPath("https://example.com"), null);
  assert.equal(navigation.safeQuarkReturnPath("//example.com"), null);
});
