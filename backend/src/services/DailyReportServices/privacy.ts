export const maskManagerPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) *****-${digits.slice(
    -4
  )}`;
};

const csvCell = (value: unknown): string =>
  `"${String(value === null || value === undefined ? "" : value).replace(
    /"/g,
    '""'
  )}"`;

export const buildDailyReportCsv = (snapshot: Record<string, any>): string => {
  const rows: unknown[][] = [["seção", "indicador", "valor"]];
  ["attendance", "messages", "appointments", "alerts"].forEach(section => {
    Object.entries(snapshot[section] || {}).forEach(([metric, value]) => {
      rows.push([section, metric, value]);
    });
  });
  (snapshot.agents || []).forEach((agent: Record<string, unknown>) => {
    Object.entries(agent).forEach(([metric, value]) => {
      rows.push([
        `agent:${String(agent.name || agent.id || "unknown")}`,
        metric,
        value
      ]);
    });
  });
  (snapshot.dataQuality?.warnings || []).forEach(
    (warning: string, index: number) => {
      rows.push(["dataQuality", `warning_${index + 1}`, warning]);
    }
  );
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}`;
};
