const digitsOnly = value => String(value || "").replace(/\D/g, "");

export const isUnresolvedWhatsAppIdentity = contact => {
  const lid = digitsOnly(contact?.lid);
  const number = digitsOnly(contact?.number);
  return Boolean(lid && number && lid === number);
};

export const contactDisplayName = (contact, fallback = "Contato WhatsApp") => {
  const name = String(contact?.name || "").trim();
  if (!isUnresolvedWhatsAppIdentity(contact)) return name || fallback;

  const lid = digitsOnly(contact?.lid);
  const nameDigits = digitsOnly(name);
  const technicalName =
    !name ||
    name === "Contato WhatsApp" ||
    /@lid$/i.test(name) ||
    (lid && nameDigits === lid);

  return technicalName ? fallback : name;
};

export const contactPhoneLabel = (contact, formatter = value => value) => {
  if (isUnresolvedWhatsAppIdentity(contact)) return "Aguardando sincronização";
  return contact?.number ? formatter(contact.number) : "Não informado";
};
