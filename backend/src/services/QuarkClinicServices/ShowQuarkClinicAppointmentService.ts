import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import { buildAppointmentSnapshot } from "./appointmentUtils";
import { getQuarkConfig } from "./config";
import { getQuarkAppointment } from "./QuarkClinicClient";

export interface QuarkClinicAppointmentDetail {
  appointmentId: string;
  patientName: string;
  scheduledAt: string | null;
  status: string;
  clinicName: string | null;
  professionalName: string | null;
  procedureName: string | null;
  specialtyName: string | null;
  clinicTimezone: string;
  refreshedAt: string;
}

const optionalName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const ShowQuarkClinicAppointmentService = async (
  appointmentId: string
): Promise<QuarkClinicAppointmentDetail> => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(appointmentId || "")) {
    throw new AppError("ERR_INVALID_APPOINTMENT_ID", 400);
  }

  const storedAppointment = await QuarkAppointment.findOne({
    where: { appointmentId },
    attributes: ["appointmentId"]
  });

  if (!storedAppointment) {
    throw new AppError("ERR_QUARK_APPOINTMENT_NOT_FOUND", 404);
  }

  const config = getQuarkConfig();
  const remote = await getQuarkAppointment(config, appointmentId);
  const snapshot = buildAppointmentSnapshot(remote, config);

  return {
    appointmentId: snapshot.appointmentId,
    patientName: snapshot.patientName,
    scheduledAt: snapshot.scheduledAt?.toISOString() || null,
    status: snapshot.status,
    clinicName: optionalName(remote.clinicaNome),
    professionalName: optionalName(remote.profissional?.nome),
    procedureName: optionalName(remote.procedimento?.nome),
    specialtyName: optionalName(remote.especialidade?.nome),
    clinicTimezone: config.timezone,
    refreshedAt: new Date().toISOString()
  };
};

export default ShowQuarkClinicAppointmentService;
