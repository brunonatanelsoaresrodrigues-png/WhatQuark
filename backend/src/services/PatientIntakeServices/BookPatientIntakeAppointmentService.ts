import crypto from "crypto";
import PatientIntakeBooking from "../../models/PatientIntakeBooking";
import Ticket from "../../models/Ticket";
import { assertExecution } from "../MessagingServices/policy";
import { writeState } from "../MessagingServices/state";
import { zonedDate } from "../QuarkClinicServices/clinicTime";
import {
  createQuarkAppointment,
  createQuarkPatient,
  findQuarkPatientByCpf,
  listQuarkAppointments
} from "../QuarkClinicServices/QuarkClinicClient";
import { getQuarkConfig } from "../QuarkClinicServices/config";
import { QuarkAgendaDto } from "../QuarkClinicServices/types";
import {
  PatientIntakeContext,
  IntakeSlotOption
} from "./PatientIntakeContextService";
import {
  getIntakeAgenda,
  revalidateIntakeSlot
} from "./QuarkAvailabilityService";

export type IntakeBookingResult =
  | { status: "SUCCESS"; appointmentId: string }
  | { status: "PROCESSING" }
  | { status: "SLOT_UNAVAILABLE" }
  | { status: "FAILED"; errorCode: string };

const normalize = (value: unknown): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const parseDate = (date: string, time: string): Date | undefined => {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = time.match(/^([0-2]\d):([0-5]\d)$/);
  if (!match || !timeMatch) return undefined;
  const value = zonedDate(
    Number(match[3]),
    Number(match[2]),
    Number(match[1]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0
  );
  return value || undefined;
};

const apiDate = (value: string): string => value.split("/").join("-");

const formatPhone = (raw: string): string => {
  let digits = raw.replace(/\D/g, "");
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const numericId = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const selectProcedureId = (
  agenda: QuarkAgendaDto,
  context: PatientIntakeContext
): number | undefined => {
  const procedures = agenda.procedimentos || [];
  let tokens = ["CONSULTA PSIQUIATR"];
  if (context.specialty === "PSYCHOLOGY") {
    tokens = ["CONSULTA PSICOLOG", "ANAMNESE PSICOLOG"];
  } else if (context.specialty === "REPORT") {
    tokens = ["LAUDO"];
  }
  const preferred = procedures.find(procedure => {
    const name = normalize(procedure.nome || procedure.descricao);
    return (
      tokens.some(token => name.includes(token)) && !name.includes("RETORNO")
    );
  });
  return numericId(preferred?.id);
};

const selectInsuranceId = (
  agenda: QuarkAgendaDto,
  context: PatientIntakeContext
): number | undefined => {
  if (context.payment !== "INSURANCE") {
    const privateOption = (agenda.convenios || []).find(option =>
      normalize(option.nome || option.descricao).includes("PARTICULAR")
    );
    return numericId(privateOption?.id);
  }
  const requested = normalize(context.insurance);
  const match = (agenda.convenios || []).find(option => {
    const current = normalize(option.nome || option.descricao);
    return (
      current === requested ||
      current.includes(requested) ||
      requested.includes(current)
    );
  });
  return numericId(match?.id);
};

const requestKey = (ticketId: number, slot: IntakeSlotOption): string =>
  crypto
    .createHash("sha256")
    .update(`${ticketId}|${slot.agendaId}|${slot.date}|${slot.time}`)
    .digest("hex");

const recoverCreatedAppointment = async (
  context: PatientIntakeContext,
  slot: IntakeSlotOption,
  patientId?: number
): Promise<string | undefined> => {
  if (!patientId) return undefined;
  const appointments = await listQuarkAppointments(
    getQuarkConfig(),
    apiDate(slot.date),
    apiDate(slot.date)
  );
  const match = appointments.find(
    appointment =>
      String(appointment.pacienteId || "") === String(patientId) &&
      String(appointment.agendaId || "") === slot.agendaId &&
      String(appointment.horaAgendamento || "").slice(0, 5) === slot.time &&
      normalize(appointment.statusMarcacao) !== "CANCELADO"
  );
  return match ? String(match.id) : undefined;
};

const BookPatientIntakeAppointmentService = async (
  ticket: Ticket,
  context: PatientIntakeContext
): Promise<IntakeBookingResult> => {
  const slot = context.selectedSlot;
  const scheduledAt = slot ? parseDate(slot.date, slot.time) : undefined;
  if (
    !slot ||
    !scheduledAt ||
    !context.cpf ||
    !context.patientName ||
    !context.birthDate
  ) {
    return { status: "FAILED", errorCode: "INCOMPLETE_INTAKE_CONTEXT" };
  }

  const key = requestKey(ticket.id, slot);
  const [attempt, created] = await PatientIntakeBooking.findOrCreate({
    where: { requestKey: key },
    defaults: {
      ticketId: ticket.id,
      requestKey: key,
      status: "PROCESSING",
      agendaId: slot.agendaId,
      scheduledAt,
      quarkAppointmentId: null,
      lastError: null
    }
  });
  if (!created && attempt.status === "SUCCESS" && attempt.quarkAppointmentId) {
    return { status: "SUCCESS", appointmentId: attempt.quarkAppointmentId };
  }
  if (
    !created &&
    attempt.status === "PROCESSING" &&
    Date.now() - attempt.updatedAt.getTime() < 2 * 60 * 1000
  ) {
    return { status: "PROCESSING" };
  }

  const config = getQuarkConfig();
  let mutationStarted = false;
  try {
    await assertExecution(ticket.contact?.number, true);
    let patient = await findQuarkPatientByCpf(config, context.cpf);
    let patientId = numericId(patient?.id);
    if (!created) {
      const recovered = await recoverCreatedAppointment(
        context,
        slot,
        patientId
      );
      if (recovered) {
        await attempt.update({
          status: "SUCCESS",
          quarkAppointmentId: recovered,
          lastError: null
        });
        return { status: "SUCCESS", appointmentId: recovered };
      }
      // A missing record on a read is not proof that a previous POST failed.
      await attempt.update({
        status: "UNKNOWN",
        lastError: "QUARK_BOOKING_OUTCOME_UNKNOWN"
      });
      await writeState(`bot-review:${ticket.id}`, {
        errorCode: "QUARK_BOOKING_OUTCOME_UNKNOWN",
        createdAt: new Date().toISOString()
      });
      return { status: "FAILED", errorCode: "QUARK_BOOKING_OUTCOME_UNKNOWN" };
    }

    if (!(await revalidateIntakeSlot(slot))) {
      await attempt.update({ status: "SLOT_UNAVAILABLE" });
      return { status: "SLOT_UNAVAILABLE" };
    }

    // Keep the local contact registration useful for the team without
    // replacing a CPF that was already entered manually.
    if (ticket.contact?.update && !ticket.contact.cpf) {
      await ticket.contact.update({ cpf: context.cpf });
    }

    const agenda = await getIntakeAgenda(slot.agendaId);
    if (!agenda) throw new Error("QUARK_AGENDA_NOT_FOUND");
    const unitId = numericId(agenda.clinicaId);
    const phone = formatPhone(ticket.contact?.number || "");
    await ticket.reload();
    if (
      ticket.userId ||
      ticket.status === "closed" ||
      ticket.intakeStatus === "PAUSED_HUMAN"
    )
      throw new Error("ERR_BOT_PAUSED");
    await assertExecution(ticket.contact?.number, true);
    if (!patientId) {
      mutationStarted = true;
      patientId = await createQuarkPatient(config, {
        cpf: context.cpf,
        dataNascimento: context.birthDate,
        nome: context.patientName,
        telefone: phone,
        unidadeId: unitId,
        filterPorCPF: true
      });
      patient = { id: patientId, nome: context.patientName };
    }

    await ticket.reload();
    if (
      ticket.userId ||
      ticket.status === "closed" ||
      ticket.intakeStatus === "PAUSED_HUMAN"
    )
      throw new Error("ERR_BOT_PAUSED");
    await assertExecution(ticket.contact?.number, true);
    mutationStarted = true;
    const appointmentId = await createQuarkAppointment(config, {
      agendaId: Number(slot.agendaId),
      convenioId: selectInsuranceId(agenda, context),
      data: slot.date,
      especialidadeId: numericId(context.selectedProfessional?.specialtyId),
      hora: slot.time,
      nomePaciente: context.patientName,
      pacienteId: patientId,
      procedimentosIds: (() => {
        const procedureId = selectProcedureId(agenda, context);
        return procedureId ? [procedureId] : undefined;
      })(),
      telefonePaciente: phone,
      telemedicina: Boolean(agenda.telemedicina),
      unidadeId: unitId
    });
    await attempt.update({
      status: "SUCCESS",
      quarkAppointmentId: String(appointmentId),
      lastError: null
    });
    return { status: "SUCCESS", appointmentId: String(appointmentId) };
  } catch (error) {
    const errorCode = (
      mutationStarted
        ? "QUARK_BOOKING_OUTCOME_UNKNOWN"
        : error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR"
    )
      .replace(/[\r\n]+/g, " ")
      .slice(0, 500);
    await attempt.update({
      status: mutationStarted ? "UNKNOWN" : "FAILED",
      lastError: errorCode
    });
    if (mutationStarted)
      await writeState(`bot-review:${ticket.id}`, {
        errorCode,
        createdAt: new Date().toISOString()
      });
    return { status: "FAILED", errorCode };
  }
};

export default BookPatientIntakeAppointmentService;
