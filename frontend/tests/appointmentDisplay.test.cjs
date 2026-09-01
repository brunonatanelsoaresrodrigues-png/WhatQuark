const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/appointmentDisplay.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const display = loaded.exports;

const timezone = "America/Sao_Paulo";
const now = new Date("2026-08-28T15:00:00.000Z");

test("formats clinic appointments with a stable local date and time", () => {
  assert.equal(
    display.appointmentDateTimeLabel("2026-09-02T12:30:00.000Z", timezone),
    "02/09/2026 às 09:30"
  );
});

test("counts calendar days from today in the clinic timezone", () => {
  assert.equal(
    display.appointmentDayLabel("2026-09-02T12:30:00.000Z", now, timezone),
    "Em 5 dias"
  );
  assert.equal(
    display.appointmentDayLabel("2026-08-27T12:30:00.000Z", now, timezone),
    "Há 1 dia"
  );
  assert.equal(
    display.appointmentDayLabel("2026-08-18T12:30:00.000Z", now, timezone),
    "Há 10 dias"
  );
  assert.equal(
    display.appointmentDayLabel("2026-08-28T23:30:00.000Z", now, timezone),
    "Hoje"
  );
});

test("uses readable appointment status labels", () => {
  assert.equal(display.appointmentStatusLabel("CONFIRMADO"), "Confirmada");
  assert.equal(display.appointmentStatusLabel("AGENDADO"), "Agendada");
  assert.equal(display.appointmentStatusLabel("EM_ATENDIMENTO"), "EM_ATENDIMENTO");
});

test("only enables manual confirmation for a future scheduled appointment", () => {
  const currentTime = new Date("2026-09-01T15:00:00.000Z").getTime();
  assert.equal(
    display.appointmentConfirmationDisabledReason(
      { status: "AGENDADO", scheduledAt: "2026-09-02T15:00:00.000Z" },
      currentTime
    ),
    ""
  );
  assert.equal(
    display.appointmentConfirmationDisabledReason(
      { status: "CONFIRMADO", scheduledAt: "2026-09-02T15:00:00.000Z" },
      currentTime
    ),
    "A consulta já está confirmada."
  );
  assert.equal(
    display.appointmentConfirmationDisabledReason(
      { status: "AGENDADO", scheduledAt: "2026-09-01T14:59:59.000Z" },
      currentTime
    ),
    "O horário da consulta já passou."
  );
});
