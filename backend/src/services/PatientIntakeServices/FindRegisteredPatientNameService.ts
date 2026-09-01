import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import { quarkPhoneVariants } from "../QuarkClinicServices/appointmentUtils";

const normalizedIdentity = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const firstName = (value: string): string | undefined => {
  const safe = value
    .replace(/[\r\n*_~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0];
  if (!safe || safe.length < 2 || /^paciente$/i.test(safe)) return undefined;
  return `${safe.charAt(0).toLocaleUpperCase("pt-BR")}${safe
    .slice(1)
    .toLocaleLowerCase("pt-BR")}`;
};

const FindRegisteredPatientNameService = async (
  phone: string
): Promise<string | undefined> => {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone) return undefined;
  const phoneVariants = quarkPhoneVariants(normalizedPhone);

  const recipients = await QuarkAppointmentRecipient.findAll({
    where: { phone: { [Op.in]: phoneVariants }, active: true },
    attributes: ["appointmentId"],
    order: [["updatedAt", "DESC"]],
    limit: 50
  });
  const appointmentIds = Array.from(
    new Set(recipients.map(recipient => recipient.appointmentId))
  );
  if (!appointmentIds.length) return undefined;

  const appointments = await QuarkAppointment.findAll({
    where: { appointmentId: { [Op.in]: appointmentIds } },
    order: [["scheduledAt", "DESC"]]
  });
  if (!appointments.length) return undefined;

  const patientIds = new Set(
    appointments.map(item => item.patientId).filter(Boolean)
  );
  const names = new Set(
    appointments
      .map(item => normalizedIdentity(item.patientName || ""))
      .filter(Boolean)
  );

  // Um telefone compartilhado por pacientes diferentes nunca recebe um nome
  // presumido, evitando atribuir o cadastro à pessoa errada.
  if (patientIds.size > 1 || (!patientIds.size && names.size > 1)) {
    return undefined;
  }

  return firstName(appointments[0].patientName || "");
};

export default FindRegisteredPatientNameService;
