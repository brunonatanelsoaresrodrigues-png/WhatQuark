import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { setInRedis, deleteFromRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import { buildRedisKey, shouldUseRedis } from "./wppKeyStorage";

interface StoreKeyRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  id: string;
  value: any;
}

const StoreWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  id,
  value
}: StoreKeyRequest): Promise<void> => {
  if (shouldUseRedis(type)) {
    const redisKey = buildRedisKey(connectionId, deviceId, type, id);

    if (value === null || value === undefined) {
      await deleteFromRedis(redisKey);
      return;
    }

    await setInRedis(redisKey, JSON.stringify(value, BufferJSON.replacer));

    return;
  }

  try {
    if (value === null || value === undefined) {
      await WppKey.destroy({ where: { connectionId, type, keyId: id } });
      return;
    }

    await WppKey.upsert({
      connectionId,
      type,
      keyId: id,
      value: JSON.stringify(value, BufferJSON.replacer)
    });
  } catch (err) {
    logger.error({
      info: "Error storing key in database",
      connectionId,
      type,
      keyId: id,
      err
    });
  }
};

export default StoreWppSessionKeys;
