import { createHash, randomBytes } from "crypto";
import { Op } from "sequelize";
import AutomationState from "../../models/AutomationState";
import AppError from "../../errors/AppError";

export const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export const readState = async <T>(id: string, fallback: T): Promise<T> => {
  const row = await AutomationState.findByPk(id);
  return row ? (JSON.parse(row.data) as T) : fallback;
};
export const writeState = async (id: string, data: unknown): Promise<void> => {
  await AutomationState.upsert({ id, data: JSON.stringify(data) });
};

// Ownership is checked on release: an expired holder cannot release a newer lease.
export const withLease = async <T>(
  id: string,
  action: () => Promise<T>
): Promise<T> => {
  await AutomationState.findOrCreate({
    where: { id },
    defaults: { id, data: "{}" }
  });
  const owner = randomBytes(16).toString("hex");
  const [claimed] = await AutomationState.update(
    { lockOwner: owner, lockedUntil: new Date(Date.now() + 15 * 60000) },
    {
      where: {
        id,
        [Op.or]: [
          { lockedUntil: null },
          { lockedUntil: { [Op.lt]: new Date() } }
        ]
      }
    }
  );
  if (!claimed) throw new AppError("ERR_OPERATION_BUSY", 409);
  try {
    return await action();
  } finally {
    await AutomationState.update(
      { lockOwner: null, lockedUntil: null },
      { where: { id, lockOwner: owner } }
    );
  }
};
