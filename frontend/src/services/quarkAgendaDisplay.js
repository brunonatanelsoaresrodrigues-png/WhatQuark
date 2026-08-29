const localIsoDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

export const quarkMonthRange = (date = new Date()) => ({
  from: localIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)),
  to: localIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
});

export const formatQuarkPhone = value => {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11)
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  if (!digits) return "Sem telefone";
  return String(value).trim().startsWith("+") ? String(value).trim() : `+${digits}`;
};
