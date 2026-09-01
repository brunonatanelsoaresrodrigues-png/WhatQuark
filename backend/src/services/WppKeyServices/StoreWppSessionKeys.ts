import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { setInRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

interface StoreKeyRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  id: string;
  value: any;
}

const REDIS_KEY_TYPES = ["session", "sender-keys", "sender-key-memory"];
const MAX_DATABASE_ATTEMPTS = 3;
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
const isDeadlock = (error: any): boolean =>
  [error?.code, error?.original?.code, error?.parent?.code].includes(
    "ER_LOCK_DEADLOCK"
  ) || [error?.errno, error?.original?.errno, error?.parent?.errno].includes(1213);

const StoreWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  id,
  value
}: StoreKeyRequest): Promise<void> => {
  const valueJson = JSON.stringify(value, BufferJSON.replacer);

  if (REDIS_KEY_TYPES.includes(type)) {
    const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
    await setInRedis(redisKey, valueJson);

    return;
  }

  for (let attempt = 1; attempt <= MAX_DATABASE_ATTEMPTS; attempt += 1) {
    try {
      await WppKey.upsert({
        connectionId,
        type,
        keyId: id,
        value: valueJson
      });
      return;
    } catch (err) {
      if (isDeadlock(err) && attempt < MAX_DATABASE_ATTEMPTS) {
        // A curta espera evita que lotes de pre-keys voltem a disputar os
        // mesmos índices na mesma janela de transação.
        // eslint-disable-next-line no-await-in-loop
        await wait(25 * 2 ** (attempt - 1));
        continue;
      }
      logger.error({
        info: "Error storing key in database",
        connectionId,
        type,
        keyId: id,
        attempts: attempt,
        err
      });
      return;
    }
  }
};

export default StoreWppSessionKeys;
