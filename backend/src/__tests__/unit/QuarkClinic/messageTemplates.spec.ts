import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  changedAppointmentMessage,
  manualReminderAppointmentMessage,
  newAppointmentMessage,
  reminderAppointmentMessage
} from "../../../services/QuarkClinicServices/messageTemplates";

const config = {
  defaultCountryCode: "55"
} as QuarkConfig;

const snapshot = buildAppointmentSnapshot(
  {
    id: 42,
    nomePaciente: "CLAUDESON NASCIMENTO DA SILVA",
    dataAgendamento: "21-08-2026",
    horaAgendamento: "16:00:00",
    statusMarcacao: "AGENDADO",
    telefoneComDDI: "+5585999990000",
    clinicaNome: "ESSENCIAL SAÚDE",
    profissional: { nome: "ASDRUBAL PEREZ SOTO" },
    procedimento: { nome: "Consulta" }
  },
  config
);

describe("Privacy-aware appointment notices", () => {
  it.each([newAppointmentMessage, manualReminderAppointmentMessage])(
    "uses absolute dates and omits unnecessary health details",
    render => {
      const body = render(snapshot);
      expect(body).toContain("21/08/2026 às 16:00");
      expect(body).toContain("ESSENCIAL SAÚDE");
      expect(body).not.toContain("CLAUDESON");
      expect(body).not.toContain("ASDRUBAL");
      expect(body).not.toMatch(
        /hoje|amanhã|ordem de chegada|NÃO para cancelar/
      );
    }
  );
  it("does not guess today or tomorrow for delayed reminders", () => {
    expect(reminderAppointmentMessage(snapshot, 2)).toContain("21/08/2026");
    expect(reminderAppointmentMessage(snapshot, 2)).not.toMatch(/hoje|amanhã/);
  });
  it("uses same-day wording when the changed appointment time already passed", () => {
    const body = changedAppointmentMessage(
      snapshot,
      "",
      new Date("2026-08-21T20:00:00.000Z"),
      "America/Sao_Paulo"
    );
    expect(body).toContain("agendamento de hoje, às 16:00");
    expect(body).not.toContain("está prevista");
  });
});
