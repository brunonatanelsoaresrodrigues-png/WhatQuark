import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import QuarkAppointment from "../../models/QuarkAppointment";
import {
  quarkCpfFrom,
  quarkPatientIdFrom,
  quarkPhoneVariants
} from "./appointmentUtils";
import { QuarkAppointmentDto } from "./types";
import { getQuarkConfig } from "./config";
import { getQuarkAppointment, getQuarkPatient } from "./QuarkClinicClient";
import { logger } from "../../utils/logger";

export interface QuarkClinicContactDetail {
  contactId: number;
  patientId: string;
  patientName: string;
  cpf: string | null;
  birthDate: string | null;
  appointmentId: string;
  refreshedAt: string;
}

const stringValue = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const ShowQuarkClinicContactService = async (
  contactId: string
): Promise<QuarkClinicContactDetail> => {
  if (!/^\d+$/.test(contactId || ""))
    throw new AppError("ERR_INVALID_CONTACT_ID", 400);

  const contact = await Contact.findByPk(contactId, {
    attributes: ["id", "number", "cpf"]
  });
  if (!contact) throw new AppError("ERR_NO_CONTACT_FOUND", 404);

  const number = String(contact.number || "").replace(/\D/g, "");
  if (!number) throw new AppError("ERR_QUARK_PATIENT_NOT_FOUND", 404);
  const phoneVariants = quarkPhoneVariants(number);

  const records = await QuarkAppointment.findAll({
    where: {
      [Op.or]: [
        { phone: { [Op.in]: phoneVariants } },
        ...phoneVariants.map(phone => ({
          phones: { [Op.like]: `%${phone}%` }
        }))
      ]
    },
    attributes: [
      "appointmentId",
      "patientId",
      "patientName",
      "scheduledAt",
      "snapshot"
    ],
    order: [["scheduledAt", "DESC"]]
  });

  const patientIds = Array.from(
    new Set(
      records
        .map(item => quarkPatientIdFrom(item.patientId))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (patientIds.length > 1)
    throw new AppError("ERR_QUARK_PATIENT_AMBIGUOUS", 409);

  const patientId = patientIds[0];
  const record = records.find(
    item => quarkPatientIdFrom(item.patientId) === patientId
  );
  if (!record?.appointmentId || !patientId)
    throw new AppError("ERR_QUARK_PATIENT_NOT_FOUND", 404);

  const stored = (() => {
    try {
      return JSON.parse(record.snapshot || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const config = getQuarkConfig();
  let remote: Record<string, unknown> = {};
  if (!stored.cpf) {
    try {
      remote = (await getQuarkAppointment(
        config,
        String(record.appointmentId)
      )) as unknown as Record<string, unknown>;
    } catch {
      // The local mirror is still useful when the Quark API is temporarily unavailable.
    }
  }

  const remotePatient = [remote.paciente, remote.patient].find(
    value => value && typeof value === "object"
  ) as Record<string, unknown> | undefined;
  let patient: Record<string, unknown> = remotePatient || {};
  const appointmentCpf =
    quarkCpfFrom(remote as unknown as QuarkAppointmentDto) ||
    stringValue(stored.cpf) ||
    stringValue(contact.cpf);
  if (!appointmentCpf) {
    try {
      patient =
        ((await getQuarkPatient(
          config,
          patientId
        )) as unknown as Record<string, unknown>) || patient;
    } catch {
      // The appointment remains available if the patient endpoint is unavailable.
    }
  }
  const cpf =
    appointmentCpf || quarkCpfFrom(patient as unknown as QuarkAppointmentDto);
  const birthDate =
    stringValue(patient.dataNascimento) ||
    stringValue(patient.dataNascimentoPaciente) ||
    stringValue(remote.dataNascimento) ||
    stringValue(remote.dataNascimentoPaciente) ||
    stringValue(remotePatient?.dataNascimento) ||
    stringValue(stored.dataNascimento);

  if (cpf && !contact.cpf) {
    await contact.update({ cpf }).catch(error =>
      logger.error({
        info: "Quark CPF could not be persisted to the contact",
        contactId: contact.id,
        err: error
      })
    );
  }

  return {
    contactId: Number(contact.id),
    patientId,
    patientName:
      stringValue(patient.nome) ||
      stringValue(patient.nomePaciente) ||
      stringValue(remote.nomePaciente) ||
      stringValue(remotePatient?.nome) ||
      record.patientName ||
      "Paciente",
    cpf,
    birthDate,
    appointmentId: String(record.appointmentId),
    refreshedAt: new Date().toISOString()
  };
};

export default ShowQuarkClinicContactService;
