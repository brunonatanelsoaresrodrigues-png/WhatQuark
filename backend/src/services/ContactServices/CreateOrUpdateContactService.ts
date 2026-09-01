import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactCustomField from "../../models/ContactCustomField";
import sequelize from "../../database";
import { UniqueConstraintError } from "sequelize";
import { logger } from "../../utils/logger";
import {
  incomingContactName,
  storedContactName
} from "../../helpers/ContactIdentity";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  lid?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  isInternal?: boolean;
  emitEvent?: boolean;
}

const emitContact = (action: "update" | "create", contact: Contact) => {
  const io = getIO();

  io.emit("contact", { action, contact });
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  lid,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = [],
  isInternal = false,
  emitEvent: shouldEmitEvent = true
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  if (!number && !lid) throw new Error("Either number or lid must be provided");
  const normalizedIncomingName = incomingContactName(name, number, lid);
  let action: "update" | "create" = "update";
  let mergedContactId: number | null = null;

  const persist = async (): Promise<Contact> =>
    sequelize.transaction(async transaction => {
      const [contactByNumber, contactByLid] = await Promise.all([
        number
          ? Contact.findOne({ where: { number }, transaction, lock: true })
          : null,
        lid
          ? Contact.findOne({ where: { lid }, transaction, lock: true })
          : null
      ]);

      const shouldMerge =
        contactByNumber &&
        contactByLid &&
        contactByNumber.id !== contactByLid.id;

      if (shouldMerge) {
        const primaryId = contactByNumber.id;
        const duplicateId = contactByLid.id;

        await Promise.all([
          Ticket.update(
            { contactId: primaryId },
            { where: { contactId: duplicateId }, transaction }
          ),
          Message.update(
            { contactId: primaryId },
            { where: { contactId: duplicateId }, transaction }
          ),
          ContactCustomField.update(
            { contactId: primaryId },
            { where: { contactId: duplicateId }, transaction }
          )
        ]);

        await contactByNumber.update(
          {
            name: storedContactName(
              contactByNumber.name,
              normalizedIncomingName || contactByLid.name,
              number,
              lid || contactByLid.lid
            ),
            lid: lid || contactByLid.lid,
            email: contactByNumber.email || contactByLid.email || email,
            cpf: contactByNumber.cpf || contactByLid.cpf || null,
            profilePicUrl:
              profilePicUrl ||
              contactByNumber.profilePicUrl ||
              contactByLid.profilePicUrl,
            isInternal:
              contactByNumber.isInternal ||
              contactByLid.isInternal ||
              isInternal
          },
          { transaction }
        );
        await contactByLid.destroy({ transaction });
        mergedContactId = duplicateId;
        return contactByNumber;
      }

      if (contactByNumber) {
        await contactByNumber.update(
          {
            name: storedContactName(
              contactByNumber.name,
              normalizedIncomingName,
              number,
              lid || contactByNumber.lid
            ),
            lid: lid || contactByNumber.lid,
            ...(profilePicUrl ? { profilePicUrl } : {}),
            isInternal: contactByNumber.isInternal || isInternal
          },
          { transaction }
        );
        return contactByNumber;
      }

      if (contactByLid) {
        await contactByLid.update(
          {
            name: storedContactName(
              contactByLid.name,
              normalizedIncomingName,
              number || contactByLid.number,
              lid || contactByLid.lid
            ),
            number: number || contactByLid.number,
            ...(profilePicUrl ? { profilePicUrl } : {}),
            isInternal: contactByLid.isInternal || isInternal
          },
          { transaction }
        );
        return contactByLid;
      }

      action = "create";
      return Contact.create(
        {
          name: normalizedIncomingName,
          number,
          lid,
          profilePicUrl,
          email,
          isGroup,
          isInternal,
          extraInfo
        },
        { transaction }
      );
    });

  let contact: Contact;
  try {
    contact = await persist();
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    // A concurrent first message may have created this identity meanwhile.
    const concurrentContact =
      (number ? await Contact.findOne({ where: { number } }) : null) ||
      (lid ? await Contact.findOne({ where: { lid } }) : null);
    if (!concurrentContact) throw error;
    contact = concurrentContact;
    action = "update";
  }

  if (mergedContactId) {
    logger.info({
      info: "Merged contacts by number and lid without losing history",
      primaryContactId: contact.id,
      mergedContactId
    });
  }
  if (shouldEmitEvent) emitContact(action, contact);
  return contact;
};

export default CreateOrUpdateContactService;
