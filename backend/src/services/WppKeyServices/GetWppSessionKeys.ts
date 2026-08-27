import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getFromRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import { buildRedisKey, shouldUseRedis } from "./wppKeyStorage";

interface GetKeysRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  ids: string[];
}

const GetWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  ids
}: GetKeysRequest): Promise<any> => {
  const data: any = {};

  if (shouldUseRedis(type)) {
    await Promise.all(
      ids.map(async id => {
        const stored = await getFromRedis(
          buildRedisKey(connectionId, deviceId, type, id)
        );

        if (stored) {
          data[id] = JSON.parse(stored, BufferJSON.reviver);
        }
      })
    );

    return data;
  }

  try {
    await Promise.all(
      ids.map(async id => {
        const keyRecord = await WppKey.findOne({
          where: {
            connectionId,
            type,
            keyId: id
          },
          order: [["id", "DESC"]]
        });

        if (keyRecord) {
          data[id] = JSON.parse(keyRecord.value, BufferJSON.reviver);
        }
      })
    );
  } catch (err) {
    logger.error({
      info: "Error getting keys from database",
      connectionId,
      type,
      err
    });
  }

  return data;
};

export default GetWppSessionKeys;
