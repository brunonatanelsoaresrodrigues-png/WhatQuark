import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import { ApplyQuarkDecision } from "./ApplyQuarkDecision";
interface Request {
  appointmentId: string;
  actorUserId: number;
}
const ConfirmQuarkAppointmentFromDashboardService = async ({
  appointmentId,
  actorUserId
}: Request): Promise<{ confirmed: true; status: "CONFIRMADO" }> => {
  if (!Number.isInteger(actorUserId) || actorUserId <= 0)
    throw new AppError("ERR_NO_PERMISSION", 403);
  const appointment = await QuarkAppointment.findOne({
    where: { appointmentId }
  });
  if (!appointment?.phone) throw new AppError("ERR_APPOINTMENT_NOT_FOUND", 404);
  await ApplyQuarkDecision({
    appointmentId,
    phone: appointment.phone,
    choice: 1,
    actorUserId
  });
  return { confirmed: true, status: "CONFIRMADO" };
};
export default ConfirmQuarkAppointmentFromDashboardService;
