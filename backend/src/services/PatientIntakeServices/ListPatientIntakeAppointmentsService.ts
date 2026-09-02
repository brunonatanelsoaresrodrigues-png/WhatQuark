import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import { getQuarkConfig } from "../QuarkClinicServices/config";
import { findQuarkPatientByCpf } from "../QuarkClinicServices/QuarkClinicClient";
import {
  formatAppointmentDateTime,
  quarkPhoneVariants
} from "../QuarkClinicServices/appointmentUtils";
import { IntakeAppointmentOption } from "./PatientIntakeContextService";

export type PatientAppointmentLookupResult =
  | {
      status: "FOUND";
      patientName: string;
      appointments: IntakeAppointmentOption[];
    }
  | { status: "NOT_FOUND" | "IDENTITY_MISMATCH" };

interface StoredSnapshot {
  profissionalNome?: string | null;
}

const storedSnapshot = (value?: string | null): StoredSnapshot => {
  try {
    return JSON.parse(value || "{}") as StoredSnapshot;
  } catch (_) {
    return {};
  }
};

const canonicalBirthDate = (value?: string): string | undefined => {
  const normalized = String(value || "").trim();
  let match = normalized.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) return `${match[1]}${match[2]}${match[3]}`;
  match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (match) return `${match[3]}${match[2]}${match[1]}`;
  return undefined;
};

const canonicalName = (value?: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const ListPatientIntakeAppointmentsService = async (
  cpf: string,
  birthDate: string | undefined,
  phone: string,
  patientName?: string
): Promise<PatientAppointmentLookupResult> => {
  const config = getQuarkConfig();
  const patient = await findQuarkPatientByCpf(config, cpf.replace(/\D/g, ""));
  if (!patient) return { status: "NOT_FOUND" };

  const expectedBirthDate = canonicalBirthDate(patient.dataNascimento);
  const birthDateMatches = Boolean(
    birthDate &&
      (!expectedBirthDate ||
        expectedBirthDate === canonicalBirthDate(birthDate))
  );
  const nameMatches = Boolean(
    patientName &&
      canonicalName(patient.nome) &&
      canonicalName(patient.nome) === canonicalName(patientName)
  );
  if (!birthDateMatches && !nameMatches) {
    return { status: "IDENTITY_MISMATCH" };
  }

  const phoneVariants = quarkPhoneVariants(phone, config.defaultCountryCode);
  const rows = await QuarkAppointment.findAll({
    where: {
      patientId: String(patient.id),
      status: { [Op.in]: ["AGENDADO", "CONFIRMADO"] },
      scheduledAt: { [Op.gte]: new Date() }
    },
    order: [["scheduledAt", "ASC"]],
    limit: 20
  });

  const appointments = rows
    .filter(
      row =>
        Boolean(row.scheduledAt) &&
        Boolean(row.phone) &&
        phoneVariants.includes(String(row.phone)) &&
        (row.status === "AGENDADO" || row.status === "CONFIRMADO")
    )
    .slice(0, 9)
    .map(row => {
      const display = formatAppointmentDateTime(row.scheduledAt);
      const snapshot = storedSnapshot(row.snapshot);
      return {
        appointmentId: row.appointmentId,
        patientId: String(patient.id),
        patientName: patient.nome || row.patientName || "Paciente",
        professionalName: snapshot.profissionalNome || "Profissional",
        date: display.date,
        time: display.time,
        status: row.status as "AGENDADO" | "CONFIRMADO",
        scheduleFingerprint: row.scheduleFingerprint
      };
    });

  if (appointments.length === 0) return { status: "NOT_FOUND" };
  return {
    status: "FOUND",
    patientName: patient.nome || appointments[0].patientName,
    appointments
  };
};

export default ListPatientIntakeAppointmentsService;
