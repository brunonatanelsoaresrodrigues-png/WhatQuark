import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import { dueReminder } from "../../../services/QuarkClinicServices/reminderTiming";

const config = {
  defaultCountryCode: "55",
  reminderHours: [2, 24, 48],
  timezone: "America/Sao_Paulo"
} as QuarkConfig;

const appointment = (date: string, time = "10:00:00") =>
  buildAppointmentSnapshot(
    {
      id: 42,
      nomePaciente: "Paciente Teste",
      dataAgendamento: date,
      horaAgendamento: time,
      statusMarcacao: "AGENDADO",
      telefoneComDDI: "+5511999990000"
    },
    config
  );

describe("QuarkClinic reminder timing", () => {
  it("sends one Monday main reminder on the previous Friday", () => {
    const monday = appointment("24-08-2026");
    const fridayAtEight = new Date("2026-08-21T11:00:00.000Z");

    expect(dueReminder(config, monday, fridayAtEight)).toEqual({
      hours: 48,
      mondayAdvance: true,
      sendOnlyOnWeekday: 5
    });
  });

  it("keeps the legacy Friday advance when only 24 hours is configured", () => {
    const monday = appointment("24-08-2026");
    const fridayAtEight = new Date("2026-08-21T11:00:00.000Z");

    expect(
      dueReminder({ ...config, reminderHours: [2, 24] }, monday, fridayAtEight)
    ).toEqual({ hours: 24, mondayAdvance: true, sendOnlyOnWeekday: 5 });
  });

  it("does not create the Monday 24-hour reminder on Sunday", () => {
    const monday = appointment("24-08-2026");
    const sundayAtTen = new Date("2026-08-23T13:00:00.000Z");

    expect(dueReminder(config, monday, sundayAtTen)).toBeUndefined();
  });

  it("keeps the Monday two-hour reminder on Monday", () => {
    const monday = appointment("24-08-2026");
    const mondayAtEight = new Date("2026-08-24T11:00:00.000Z");

    expect(dueReminder(config, monday, mondayAtEight)).toEqual({
      hours: 2,
      mondayAdvance: false
    });
  });

  it("keeps the regular 24-hour timing for appointments on other weekdays", () => {
    const tuesday = appointment("25-08-2026");
    const mondayAtTen = new Date("2026-08-24T13:00:00.000Z");

    expect(dueReminder(config, tuesday, mondayAtTen)).toEqual({
      hours: 24,
      mondayAdvance: false
    });
  });

  it("reminds confirmed appointments without asking them to confirm again", () => {
    const confirmed = {
      ...appointment("25-08-2026"),
      status: "CONFIRMADO"
    };
    const sundayAtTen = new Date("2026-08-23T13:00:00.000Z");

    expect(dueReminder(config, confirmed, sundayAtTen)).toEqual({
      hours: 48,
      mondayAdvance: false
    });
  });

  it("does not select a later Monday while processing the current Friday", () => {
    const laterMonday = appointment("31-08-2026");
    const fridayAtEight = new Date("2026-08-21T11:00:00.000Z");

    expect(dueReminder(config, laterMonday, fridayAtEight)).toBeUndefined();
  });
});
