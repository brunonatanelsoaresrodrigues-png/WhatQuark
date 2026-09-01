interface ContactIdentity {
  number?: string | null;
  lid?: string | null;
  isGroup?: boolean;
}

const lidUser = (lid?: string | null): string =>
  String(lid || "")
    .replace(/@lid$/i, "")
    .replace(/\D/g, "");

export const isUnresolvedLidContact = (contact: ContactIdentity): boolean => {
  const normalizedLid = lidUser(contact.lid);
  const normalizedNumber = String(contact.number || "").replace(/\D/g, "");
  return Boolean(normalizedLid && normalizedNumber === normalizedLid);
};

export const contactJid = (
  contact: ContactIdentity,
  isGroup = Boolean(contact.isGroup)
): string => {
  const number = String(contact.number || "").replace(/\D/g, "");

  if (isGroup) {
    if (!number) throw new Error("ERR_CONTACT_HAS_NO_WHATSAPP_IDENTITY");
    return `${number}@g.us`;
  }

  if (contact.lid && (!number || isUnresolvedLidContact(contact))) {
    const lid = String(contact.lid);
    return lid.includes("@") ? lid : `${lid}@lid`;
  }

  if (!number) throw new Error("ERR_CONTACT_HAS_NO_WHATSAPP_IDENTITY");
  return `${number}@c.us`;
};

export default contactJid;
