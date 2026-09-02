import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  changedAppointmentMessage,
  cancelledAppointmentMessage,
  manualReminderAppointmentMessage,
  newAppointmentMessage,
  noShowFollowUpMessage,
  noShowRecoveryMessage,
  removeLegacyConfirmationCodes,
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
    procedimento: { nome: "Consulta Psiquiatria" }
  },
  config
);

describe("Appointment notices", () => {
  it("keeps new appointment notices concise", () => {
    const body = newAppointmentMessage(snapshot);
    expect(body).toContain("21/08/2026 às 16:00");
    expect(body).toContain("ESSENCIAL SAÚDE");
    expect(body).not.toContain("CLAUDESON");
    expect(body).not.toContain("ASDRUBAL");
  });
  it("identifies the Quark patient and professional in reminders", () => {
    const body = manualReminderAppointmentMessage(snapshot);
    expect(body).toContain("Caro(a) Paciente CLAUDESON NASCIMENTO DA SILVA");
    expect(body).toContain("profissional ASDRUBAL PEREZ SOTO");
    expect(body).toContain("no dia 21/08/2026 às 16:00");
    expect(body).toContain("procedimento Consulta Psiquiatria");
    expect(body).toContain("no valor de R$ 350,00");
    expect(body).toContain("na clínica ESSENCIAL SAÚDE");
    expect(body).toContain(
      "Avenida Ulisses Bezerra, 2227 - Cidade dos Funcionários, FORTALEZA, 60822-490"
    );
    expect(body).toContain("O atendimento é realizado por ordem de chegada.");
    expect(body).not.toMatch(/hoje|amanhã|NÃO para cancelar/);
  });
  it("prefers a procedure price supplied by Quark", () => {
    const body = manualReminderAppointmentMessage({
      ...snapshot,
      raw: {
        ...snapshot.raw,
        procedimento: {
          ...snapshot.raw.procedimento,
          valor: "420,50"
        }
      }
    });
    expect(body).toContain("R$ 420,50");
  });
  it("removes appointment codes and numeric shortcuts from queued legacy text", () => {
    expect(
      removeLegacyConfirmationCodes(
        "Para confirmar: **CONFIRMAR B2DB68F5**\nPara cancelar: **CANCELAR B2DB68F5**\n*CONFIRMAR* ou *1*\n*CANCELAR* ou *2*"
      )
    ).toBe(
      "Para confirmar: **CONFIRMAR**\nPara cancelar: **CANCELAR**\n*CONFIRMAR*\n*CANCELAR*"
    );
  });
  it("does not guess today or tomorrow for delayed reminders", () => {
    expect(reminderAppointmentMessage(snapshot, 24)).toContain("21/08/2026");
    expect(reminderAppointmentMessage(snapshot, 24)).not.toMatch(/hoje|amanhã/);
  });
  it("uses a short logistics reminder two hours before the appointment", () => {
    const body = reminderAppointmentMessage(snapshot, 2);
    expect(body).toContain("Lembrete: sua consulta é hoje às 16:00");
    expect(body).toContain("ordem de chegada");
    expect(body).not.toContain("no valor de");
  });
  it("does not ask an already confirmed patient to confirm again", () => {
    const body = reminderAppointmentMessage(
      { ...snapshot, status: "CONFIRMADO" },
      24
    );
    expect(body).toContain("está confirmada para 21/08/2026 às 16:00");
    expect(body).toContain("ordem de chegada");
  });
  it("offers safe rescheduling after cancellations and confirmed no-shows", () => {
    expect(cancelledAppointmentMessage(snapshot)).toContain(
      "ajudará com o reagendamento"
    );
    expect(noShowRecoveryMessage(snapshot)).toContain(
      "não foi possível comparecer"
    );
    expect(noShowFollowUpMessage(snapshot)).toContain("deseja remarcar");
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
