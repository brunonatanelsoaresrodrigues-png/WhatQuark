import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentResponse from "../../models/QuarkAppointmentResponse";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import OutboundMessage from "../../models/OutboundMessage";
import { assertExecution } from "../MessagingServices/policy";
import { withLease, readState, writeState } from "../MessagingServices/state";
import { getQuarkConfig } from "./config";
import {
  buildAppointmentSnapshot,
  quarkPhoneVariants
} from "./appointmentUtils";
import {
  getQuarkAppointment,
  confirmQuarkAppointment,
  cancelQuarkAppointment
} from "./QuarkClinicClient";
import RecordQuarkAppointmentEventService from "./RecordQuarkAppointmentEventService";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";

interface Request {
  appointmentId: string;
  phone: string;
  choice: 1 | 2;
  fingerprint?: string;
  actorUserId?: number | null;
}
export const ApplyQuarkDecision = async ({
  appointmentId,
  phone,
  choice,
  fingerprint,
  actorUserId = null
}: Request): Promise<void> =>
  withLease(`quark-appointment:${appointmentId}`, async () => {
    await assertExecution(phone, true);
    const stateKey = `quark-operation:${appointmentId}`;
    const previous = await readState(stateKey, { status: "READY" });
    if (["UNKNOWN", "PROCESSING"].includes(previous.status))
      throw new AppError("ERR_QUARK_REVIEW_REQUIRED", 409);
    const record = await QuarkAppointment.findOne({ where: { appointmentId } });
    const config = getQuarkConfig();
    const recipientMatches = Boolean(
      record?.phone &&
        quarkPhoneVariants(record.phone, config.defaultCountryCode).includes(
          phone
        )
    );
    const localStatusAllowed =
      choice === 1
        ? record?.status === "AGENDADO" || record?.status === "CONFIRMADO"
        : record?.status === "AGENDADO" || record?.status === "CONFIRMADO";
    if (
      !record ||
      !recipientMatches ||
      !localStatusAllowed ||
      !record.scheduledAt ||
      record.scheduledAt.getTime() <= Date.now() ||
      (fingerprint && record.scheduleFingerprint !== fingerprint)
    )
      throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
    const remote = buildAppointmentSnapshot(
      await getQuarkAppointment(config, appointmentId),
      config
    );
    if (
      remote.phone !== record.phone ||
      remote.patientId !== record.patientId ||
      remote.status !== record.status ||
      remote.scheduleFingerprint !== record.scheduleFingerprint
    )
      throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
    const desired = choice === 1 ? "CONFIRMADO" : "CANCELADO";
    const audit = await QuarkAppointmentResponse.create({
      appointmentId,
      recipientPhone: phone,
      actorUserId,
      decision: choice === 1 ? "CONFIRMED" : "CANCELLED",
      source: actorUserId ? "DASHBOARD" : "WHATSAPP",
      status: "PROCESSING",
      previousQuarkStatus: record.status,
      receivedAt: new Date(),
      responseTimeSeconds:
        !actorUserId && record.confirmationRequestedAt
          ? Math.max(
              0,
              Math.round(
                (Date.now() -
                  new Date(record.confirmationRequestedAt).getTime()) /
                  1000
              )
            )
          : null
    });
    await writeState(stateKey, {
      status: "PROCESSING",
      desired,
      auditId: audit.id,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await record.update({ awaitingConfirmation: false });
    try {
      if (choice === 1)
        await confirmQuarkAppointment(config, appointmentId, phone);
      else await cancelQuarkAppointment(config, appointmentId, phone);
    } catch (error) {
      const unknown =
        error instanceof Error &&
        error.message === "QUARK_OPERATION_OUTCOME_UNKNOWN";
      await writeState(stateKey, {
        status: unknown ? "UNKNOWN" : "FAILED",
        desired,
        auditId: audit.id,
        updatedAt: new Date().toISOString()
      });
      await audit.update({
        status: unknown ? "UNKNOWN" : "FAILED",
        errorCode: unknown
          ? "QUARK_OPERATION_OUTCOME_UNKNOWN"
          : "QUARK_OPERATION_REJECTED"
      });
      emitQuarkDashboardUpdate("response", audit.id);
      throw new AppError(
        unknown ? "ERR_QUARK_REVIEW_REQUIRED" : "ERR_QUARK_OPERATION_REJECTED",
        409
      );
    }
    // A persistence failure after a successful PATCH remains PROCESSING/UNKNOWN;
    // the next attempt is blocked until an operator reconciles the remote state.
    await record.update({
      status: desired,
      awaitingConfirmation: false,
      confirmationRequestedAt: null
    });
    await QuarkAppointmentNotification.update(
      { status: "SUPPRESSED", lastError: "Appointment decision applied" },
      {
        where: {
          appointmentId,
          status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
        }
      }
    );
    await RecordQuarkAppointmentEventService({
      record,
      eventType: choice === 1 ? "CONFIRMED" : "CANCELLED",
      source: actorUserId ? "QUARK_DASHBOARD" : "PATIENT_WHATSAPP",
      newStatus: desired,
      metadata: { actorUserId }
    });
    await audit.update({
      status: "SUCCESS",
      newQuarkStatus: desired,
      appliedAt: new Date()
    });
    await writeState(stateKey, {
      status: "APPLIED",
      desired,
      auditId: audit.id,
      updatedAt: new Date().toISOString()
    });
    emitQuarkDashboardUpdate("response", audit.id);
  });
