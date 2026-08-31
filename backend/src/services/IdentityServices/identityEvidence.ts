import { createHash } from "crypto";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import QuarkAppointment from "../../models/QuarkAppointment";
import { isTechnicalContactName } from "../../helpers/ContactIdentity";
import {
  quarkCpfFrom,
  quarkPatientIdFrom,
  quarkPhoneVariants
} from "../QuarkClinicServices/appointmentUtils";
import { QuarkAppointmentDto } from "../QuarkClinicServices/types";
import { getQuarkConfig } from "../QuarkClinicServices/config";
import { getQuarkPatient } from "../QuarkClinicServices/QuarkClinicClient";

export interface QuarkIdentityCandidate {
  patientId: string;
  patientName: string;
  cpf: string | null;
  appointmentId: string;
  scheduledAt: Date | null;
}

export const valueHash = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(serialized).digest("hex");
};

export const issueFingerprint = (
  contactId: number,
  type: string,
  discriminator = ""
): string =>
  createHash("sha256")
    .update(`${contactId}:${type}:${discriminator}`)
    .digest("hex");

export const safeJson = (value: unknown): string => JSON.stringify(value);

export const parseSnapshot = (
  value: string | null | undefined
): Record<string, unknown> => {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const cpfFromAppointment = (
  appointment: QuarkAppointment
): string | null =>
  quarkCpfFrom(
    parseSnapshot(appointment.snapshot) as unknown as QuarkAppointmentDto
  );

export const maskedCpf = (cpf: string | null): string | null =>
  cpf ? `***.***.***-${cpf.slice(-2)}` : null;

export const contactHasTechnicalName = (contact: Contact): boolean =>
  isTechnicalContactName(contact.name, contact.number, contact.lid);

export const contactHasUnresolvedLid = (contact: Contact): boolean => {
  const number = String(contact.number || "").replace(/\D/g, "");
  const lid = String(contact.lid || "")
    .replace(/@lid$/i, "")
    .replace(/\D/g, "");
  return Boolean(number && lid && number === lid);
};

export const findQuarkCandidates = async (
  contact: Pick<Contact, "number">
): Promise<QuarkIdentityCandidate[]> => {
  const variants = quarkPhoneVariants(String(contact.number || ""));
  if (!variants.length) return [];
  const rows = await QuarkAppointment.findAll({
    where: {
      [Op.or]: [
        { phone: { [Op.in]: variants } },
        ...variants.map(phone => ({ phones: { [Op.like]: `%${phone}%` } }))
      ]
    },
    order: [["scheduledAt", "DESC"]]
  });
  const candidates = new Map<string, QuarkIdentityCandidate>();
  rows.forEach(row => {
    const patientId = quarkPatientIdFrom(row.patientId);
    if (!patientId) return;
    const current = candidates.get(patientId);
    const rowCpf = cpfFromAppointment(row);
    if (!current) {
      candidates.set(patientId, {
        patientId,
        patientName: row.patientName || "Paciente",
        cpf: rowCpf,
        appointmentId: row.appointmentId,
        scheduledAt: row.scheduledAt
      });
      return;
    }
    // The latest appointment can omit CPF even when an older snapshot has it.
    // Aggregate evidence for the same patient without ever combining patients.
    if (!current.cpf && rowCpf) current.cpf = rowCpf;
    if (
      isTechnicalContactName(current.patientName, "", "") &&
      row.patientName &&
      !isTechnicalContactName(row.patientName, "", "")
    ) {
      current.patientName = row.patientName;
    }
  });
  return Array.from(candidates.values());
};

export const findConfirmedQuarkCandidate = async (
  patientIdValue: string,
  refreshMissingCpf = false
): Promise<QuarkIdentityCandidate | null> => {
  const patientId = quarkPatientIdFrom(patientIdValue);
  if (!patientId) return null;
  const rows = await QuarkAppointment.findAll({
    where: { patientId },
    order: [["scheduledAt", "DESC"]]
  });
  if (!rows.length) return null;

  const latest = rows[0];
  let patientName = latest.patientName || "Paciente";
  let cpf: string | null = null;
  for (const row of rows) {
    cpf = cpf || cpfFromAppointment(row);
    if (
      isTechnicalContactName(patientName, "", "") &&
      row.patientName &&
      !isTechnicalContactName(row.patientName, "", "")
    ) {
      patientName = row.patientName;
    }
  }

  if (!cpf && refreshMissingCpf) {
    const patient = await getQuarkPatient(getQuarkConfig(), patientId);
    if (patient) {
      cpf = quarkCpfFrom(patient as unknown as QuarkAppointmentDto);
      if (
        patient.nome &&
        !isTechnicalContactName(patient.nome, "", "")
      ) {
        patientName = patient.nome;
      }
    }
  }

  return {
    patientId,
    patientName,
    cpf,
    appointmentId: latest.appointmentId,
    scheduledAt: latest.scheduledAt
  };
};
