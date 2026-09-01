const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const lidUser = (lid: unknown): string => {
  const value = clean(lid);
  if (!value) return "";
  return value.replace(/@lid$/i, "").replace(/[^0-9]/g, "");
};

export const isTechnicalContactName = (
  value: unknown,
  number: unknown,
  lid: unknown
): boolean => {
  const name = clean(value);
  const contactNumber = clean(number).replace(/[^0-9]/g, "");
  const contactLid = clean(lid);
  const contactLidUser = lidUser(contactLid);

  if (!name || name === "Contato WhatsApp") return true;
  if (/@lid$/i.test(name)) return true;
  if (contactLid && name.toLowerCase() === contactLid.toLowerCase()) return true;
  if (contactLidUser && name.replace(/[^0-9]/g, "") === contactLidUser)
    return true;
  if (contactNumber && name.replace(/[^0-9]/g, "") === contactNumber)
    return true;

  return false;
};

export const contactIdentityFallback = (
  number: unknown,
  lid: unknown
): string => {
  const contactNumber = clean(number).replace(/[^0-9]/g, "");
  const contactLidUser = lidUser(lid);

  if (contactNumber && contactNumber !== contactLidUser) return contactNumber;
  return "Contato WhatsApp";
};

export const incomingContactName = (
  name: unknown,
  number: unknown,
  lid: unknown
): string => {
  const candidate = clean(name);
  return isTechnicalContactName(candidate, number, lid)
    ? contactIdentityFallback(number, lid)
    : candidate;
};

export const bestIncomingContactName = (
  candidates: unknown[],
  number: unknown,
  lid: unknown
): string => {
  const publicName = candidates
    .map(clean)
    .find(candidate => !isTechnicalContactName(candidate, number, lid));

  return publicName || contactIdentityFallback(number, lid);
};

export const storedContactName = (
  storedName: unknown,
  providerName: unknown,
  number: unknown,
  lid: unknown
): string => {
  const current = clean(storedName);
  if (!isTechnicalContactName(current, number, lid)) return current;
  return incomingContactName(providerName, number, lid);
};
