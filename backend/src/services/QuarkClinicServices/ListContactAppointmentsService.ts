import { Op, WhereOptions } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import { appointmentReference, quarkPhoneVariants } from "./appointmentUtils";
import { clinicTimezone } from "./clinicTime";

const cancelledStatuses = ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"];
const attributes = [
  "appointmentId",
  "scheduledAt",
  "status",
  "scheduleFingerprint"
];

interface Request {
  phone: string;
  now?: Date;
  limit?: number;
}

const serialize = (appointment: QuarkAppointment, phone: string) => ({
  appointmentId: appointment.appointmentId,
  scheduledAt: appointment.scheduledAt,
  status: appointment.status,
  reference: appointmentReference(
    appointment.appointmentId,
    appointment.scheduleFingerprint,
    phone
  )
});

const ListContactAppointmentsService = async ({
  phone,
  now = new Date(),
  limit = 5
}: Request) => {
  const phoneVariants = quarkPhoneVariants(phone);
  const recipients = await QuarkAppointmentRecipient.findAll({
    where: { phone: { [Op.in]: phoneVariants }, active: true },
    attributes: ["appointmentId"]
  });
  const appointmentIds = Array.from(
    new Set(recipients.map(recipient => recipient.appointmentId))
  );
  const contact: WhereOptions[] = [
    { phone: { [Op.in]: phoneVariants } },
    ...phoneVariants.map(value => ({ phones: { [Op.like]: `%${value}%` } }))
  ];
  if (appointmentIds.length) {
    contact.push({ appointmentId: { [Op.in]: appointmentIds } });
  }
  const status = { [Op.notIn]: cancelledStatuses };

  const [upcoming, last] = await Promise.all([
    QuarkAppointment.findAll({
      where: {
        [Op.or]: contact,
        status,
        scheduledAt: { [Op.gte]: now }
      },
      attributes,
      order: [["scheduledAt", "ASC"]],
      limit
    }),
    QuarkAppointment.findOne({
      where: {
        [Op.or]: contact,
        status,
        scheduledAt: { [Op.lt]: now }
      },
      attributes,
      order: [["scheduledAt", "DESC"]]
    })
  ]);

  return {
    appointments: upcoming.map(appointment => serialize(appointment, phone)),
    lastAppointment: last ? serialize(last, phone) : null,
    clinicTimezone: clinicTimezone(),
    serverNow: now.toISOString()
  };
};

export default ListContactAppointmentsService;
