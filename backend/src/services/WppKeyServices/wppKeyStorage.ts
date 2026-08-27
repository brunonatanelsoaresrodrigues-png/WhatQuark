import { getRedisClient } from "../../libs/redisStore";

/**
 * Key categories that are hot enough to live in Redis. They are renegotiated
 * by WhatsApp when missing, so a cache with a TTL is acceptable for them.
 *
 * Every other category ("pre-key", "app-state-sync-key",
 * "app-state-sync-version") must survive a Redis flush, so it goes to the
 * database.
 */
export const REDIS_KEY_TYPES = ["session", "sender-key", "sender-key-memory"];

export const shouldUseRedis = (type: string): boolean =>
  REDIS_KEY_TYPES.includes(type) && Boolean(getRedisClient());

export const buildRedisKey = (
  connectionId: number,
  deviceId: number,
  type: string,
  id: string
): string => `wpp:${connectionId}:${deviceId}:${type}:${id}`;
