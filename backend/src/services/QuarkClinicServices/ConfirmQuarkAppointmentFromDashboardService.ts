import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import QuarkAppointmentResponse from "../../models/QuarkAppointmentResponse";
import { logger } from "../../utils/logger";
import { getQuarkConfig } from "./config";
import { confirmQuarkAppointment } from "./QuarkClinicClient";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import RecordQuarkAppointmentEventService from "./RecordQuarkAppointmentEventService";

interface Request {
  appointmentId: string;
}

const errorCodeFrom = (error: unknown): string =>
  (error instanceof Error ? error.message : "Unknown error")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);

const ConfirmQuarkAppointmentFromDashboardService = async ({
  appointmentId
}: Request): Promise<{ confirmed: true; status: "CONFIRMADO" }> => {
  const appointment = await QuarkAppointment.findOne({
    where: { appointmentId }
  });
  if (!appointment) {
    throw new AppError("Agendamento não encontrado.", 404);
  }
  if (appointment.status === "CONFIRMADO") {
    throw new AppError("Esta consulta já está confirmada no Quark.", 409);
  }
  if (appointment.status !== "AGENDADO") {
    throw new AppError(
      "Só é possível confirmar consultas com estado Agendada.",
      409
    );
  }
  if (
    !appointment.scheduledAt ||
    appointment.scheduledAt.getTime() <= Date.now()
  ) {
    throw new AppError("O horário da consulta já passou ou é inválido.", 409);
  }

  const [claimed] = await QuarkAppointment.update(
    { status: "CONFIRMING", awaitingConfirmation: false },
    { where: { id: appointment.id, status: "AGENDADO" } }
  );
  if (claimed === 0) {
    throw new AppError("Esta consulta já está sendo atualizada.", 409);
  }

  let audit: QuarkAppointmentResponse;
  try {
    audit = await QuarkAppointmentResponse.create({
      appointmentId: appointment.appointmentId,
      notificationId: null,
      decision: "CONFIRMED",
      source: "DASHBOARD",
      status: "PROCESSING",
      previousQuarkStatus: appointment.status,
      newQuarkStatus: null,
      receivedAt: new Date(),
      appliedAt: null,
      responseTimeSeconds: null,
      errorCode: null
    });
  } catch (error) {
    await QuarkAppointment.update(
      {
        status: "AGENDADO",
        awaitingConfirmation: appointment.awaitingConfirmation
      },
      { where: { id: appointment.id, status: "CONFIRMING" } }
    );
    throw error;
  }
  emitQuarkDashboardUpdate("response", audit.id);

  try {
    await confirmQuarkAppointment(getQuarkConfig(), appointment.appointmentId);
  } catch (error) {
    await QuarkAppointment.update(
      {
        status: "AGENDADO",
        awaitingConfirmation: appointment.awaitingConfirmation
      },
      { where: { id: appointment.id, status: "CONFIRMING" } }
    );
    await audit.update({
      status: "FAILED",
      appliedAt: new Date(),
      errorCode: errorCodeFrom(error)
    });
    emitQuarkDashboardUpdate("response", audit.id);
    throw new AppError(
      "O Quark não confirmou a consulta. Nenhuma confirmação local foi mantida.",
      502
    );
  }

  await RecordQuarkAppointmentEventService({
    record: appointment,
    eventType: "CONFIRMED",
    source: "QUARK_DASHBOARD",
    newStatus: "CONFIRMADO"
  });

  await appointment
    .update({
      status: "CONFIRMADO",
      awaitingConfirmation: false
    })
    .catch(error =>
      logger.error({
        info: "Quark confirmation succeeded but local appointment update failed",
        appointmentId: appointment.appointmentId,
        err: error
      })
    );
  await QuarkAppointmentNotification.update(
    {
      status: "SUPPRESSED",
      lastError: "Appointment confirmed from the dashboard"
    },
    {
      where: {
        appointmentId: appointment.appointmentId,
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
      }
    }
  ).catch(error =>
    logger.error({
      info: "Could not suppress notifications after dashboard confirmation",
      appointmentId: appointment.appointmentId,
      err: error
    })
  );
  await audit
    .update({
      status: "SUCCESS",
      newQuarkStatus: "CONFIRMADO",
      appliedAt: new Date(),
      errorCode: null
    })
    .catch(error =>
      logger.error({
        info: "Could not complete dashboard confirmation audit",
        appointmentId: appointment.appointmentId,
        err: error
      })
    );
  emitQuarkDashboardUpdate("response", audit.id);
  return { confirmed: true, status: "CONFIRMADO" };
};

export default ConfirmQuarkAppointmentFromDashboardService;
