const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface RedactionResult {
  text: string;
  removed: string[];
}

const redactSensitiveText = (value: string, patientName?: string | null): RedactionResult => {
  let text = String(value || "");
  const removed = new Set<string>();
  const replace = (pattern: RegExp, label: string) => {
    text = text.replace(pattern, () => {
      removed.add(label);
      return `[${label.toUpperCase()} REMOVIDO]`;
    });
  };

  replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi, "email");
  replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "cpf");
  replace(/(?<!\d)(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]*\d{4}(?!\d)/g, "telefone");
  replace(/(?<!\d)\d{13,20}(?!\d)/g, "telefone");

  const normalizedName = String(patientName || "").trim();
  if (normalizedName.length >= 3 && !/^contato whatsapp$/i.test(normalizedName)) {
    replace(new RegExp(escapeRegExp(normalizedName), "gi"), "nome");
  }
  return { text, removed: Array.from(removed) };
};

export default redactSensitiveText;
