import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentEvent from "../../models/QuarkAppointmentEvent";
import { AppointmentSnapshot } from "./appointmentUtils";

interface StoredSnapshot {
  profissionalId?: string | number | null;
  procedimentoId?: string | number | null;
}

const parseStoredSnapshot = (value?: string | null): StoredSnapshot => {
  try {
    return JSON.parse(value || "{}") as StoredSnapshot;
  } catch (_) {
    return {};
  }
};

interface Request {
  record?: QuarkAppointment | null;
  snapshot?: AppointmentSnapshot;
  appointmentId?: string;
  eventType: string;
  source: string;
  newStatus?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

const RecordQuarkAppointmentEventService = async ({
  record,
  snapshot,
  appointmentId,
  eventType,
  source,
  newStatus,
  metadata,
  occurredAt = new Date()
}: Request): Promise<QuarkAppointmentEvent> => {
  const previous = parseStoredSnapshot(record?.snapshot);
  return QuarkAppointmentEvent.create({
    appointmentId:
      appointmentId || snapshot?.appointmentId || record?.appointmentId,
    eventType,
    previousStatus: record?.status || null,
    newStatus: newStatus || snapshot?.status || record?.status || null,
    previousScheduledAt: record?.scheduledAt || null,
    newScheduledAt: snapshot?.scheduledAt || record?.scheduledAt || null,
    previousProfessionalId: previous.profissionalId
      ? String(previous.profissionalId)
      : null,
    newProfessionalId: snapshot?.raw.profissionalId
      ? String(snapshot.raw.profissionalId)
      : previous.profissionalId
      ? String(previous.profissionalId)
      : null,
    previousProcedureId: previous.procedimentoId
      ? String(previous.procedimentoId)
      : null,
    newProcedureId: snapshot?.raw.procedimentoId
      ? String(snapshot.raw.procedimentoId)
      : previous.procedimentoId
      ? String(previous.procedimentoId)
      : null,
    source,
    metadata: metadata ? JSON.stringify(metadata) : null,
    occurredAt
  });
};

export default RecordQuarkAppointmentEventService;
