import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import { quarkCpfFrom } from "./appointmentUtils";
import { getQuarkConfig } from "./config";
import { getQuarkAppointment } from "./QuarkClinicClient";
import { QuarkAppointmentDto } from "./types";

export interface QuarkClinicPatientDetail {
  patientId: string;
  patientName: string;
  cpf: string | null;
  birthDate: string | null;
  appointmentId: string;
  refreshedAt: string;
}

const value = (item: unknown): string | null => {
  if (typeof item !== "string" && typeof item !== "number") return null;
  const result = String(item).trim();
  return result || null;
};

const ShowQuarkClinicPatientService = async (
  patientId: string
): Promise<QuarkClinicPatientDetail> => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(patientId || ""))
    throw new AppError("ERR_INVALID_PATIENT_ID", 400);
  const records = await QuarkAppointment.findAll({
    where: { patientId: String(patientId) },
    attributes: [
      "appointmentId",
      "patientId",
      "patientName",
      "scheduledAt",
      "snapshot"
    ],
    order: [["scheduledAt", "DESC"]],
    limit: 20
  });
  const record = records.find(item => String(item.patientId) === patientId);
  if (!record?.appointmentId)
    throw new AppError("ERR_QUARK_PATIENT_NOT_FOUND", 404);
  let stored: Record<string, unknown> = {};
  try {
    stored = JSON.parse(record.snapshot || "{}");
  } catch {
    stored = {};
  }
  let remote: Record<string, unknown> = {};
  if (!stored.cpf) {
    try {
      remote = (await getQuarkAppointment(
        getQuarkConfig(),
        String(record.appointmentId)
      )) as unknown as Record<string, unknown>;
    } catch {
      // Keep the local mirror available during a short Quark outage.
    }
  }
  const nested = [remote.paciente, remote.patient].find(
    item => item && typeof item === "object"
  ) as Record<string, unknown> | undefined;
  return {
    patientId: String(patientId),
    patientName:
      value(remote.nomePaciente) || value(nested?.nome) || record.patientName,
    cpf:
      quarkCpfFrom(remote as unknown as QuarkAppointmentDto) ||
      value(stored.cpf),
    birthDate:
      value(remote.dataNascimento) ||
      value(remote.dataNascimentoPaciente) ||
      value(nested?.dataNascimento) ||
      value(stored.dataNascimento),
    appointmentId: String(record.appointmentId),
    refreshedAt: new Date().toISOString()
  };
};

export default ShowQuarkClinicPatientService;
