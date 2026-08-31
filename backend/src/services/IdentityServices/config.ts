export const identityCenterEnabled = (): boolean =>
  process.env.IDENTITY_CENTER_ENABLED !== "false";

export const identityReconciliationEnabled = (): boolean =>
  identityCenterEnabled() &&
  process.env.IDENTITY_RECONCILIATION_ENABLED !== "false";

export const identityReconciliationHour = (): number => {
  const value = Number(process.env.IDENTITY_RECONCILIATION_HOUR || 3);
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : 3;
};
