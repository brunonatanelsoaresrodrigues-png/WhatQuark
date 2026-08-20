import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
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

describe("QuarkClinic message templates", () => {
  it("uses the full Quark patient and appointment data with textual replies", () => {
    const body = newAppointmentMessage(
      snapshot,
      "Avenida Ulisses Bezerra, 2227 - Fortaleza"
    );

    expect(body).toContain("CLAUDESON NASCIMENTO DA SILVA");
    expect(body).toContain("ASDRUBAL PEREZ SOTO");
    expect(body).toContain("21/08/2026 às 16:00");
    expect(body).toContain("Consulta");
    expect(body).toContain("ESSENCIAL SAÚDE");
    expect(body).toContain("Avenida Ulisses Bezerra, 2227 - Fortaleza");
    expect(body).toContain("SIM para confirmar");
    expect(body).toContain("NÃO para cancelar");
    expect(body).not.toContain("confirmarConsultaWhatsapp");
  });

  it("identifies the two-hour reminder as a same-day reminder", () => {
    expect(reminderAppointmentMessage(snapshot, 2)).toContain(
      "sua consulta é hoje"
    );
  });

  it("creates a manual confirmation reminder without guessing the day", () => {
    const body = manualReminderAppointmentMessage(snapshot);

    expect(body).toContain("Lembrete de consulta");
    expect(body).toContain("CLAUDESON NASCIMENTO DA SILVA");
    expect(body).toContain("SIM para confirmar");
    expect(body).not.toContain("sua consulta é amanhã");
    expect(body).not.toContain("sua consulta é hoje");
  });
});
