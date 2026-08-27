import Redis from "ioredis";

import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

const REDIS_SESSION_TTL = 604800; // 7 days

const getRedisUrl = (): string | null => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.IO_REDIS_SERVER;
  if (!host) return null;

  const port = process.env.IO_REDIS_PORT || "6379";
  const password = process.env.IO_REDIS_PASSWORD
    ? `:${encodeURIComponent(process.env.IO_REDIS_PASSWORD)}@`
    : "";

  return `redis://${password}${host}:${port}`;
};

const getRedisDb = (): number => {
  const db = process.env.REDIS_DB || process.env.IO_REDIS_DB_SESSION || "0";

  return parseInt(db, 10);
};

export const initRedis = async () => {
  const redisUrl = getRedisUrl();

  if (!redisUrl || redisClient) {
    if (!redisUrl) {
      logger.warn(
        "Redis is not configured (REDIS_URL / IO_REDIS_SERVER); WhatsApp signal keys will be stored in the database only"
      );
    }
    return;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      db: getRedisDb(),
      disableClientInfo: true
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected successfully");
    });

    redisClient.on("error", err => {
      logger.error({ info: "Redis connection error", err });
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
      logger.info("Redis reconnecting...");
    });

    await redisClient.connect();

    logger.info("Redis session store initialized");
  } catch (err) {
    logger.error({ info: "Failed to initialize Redis", err });
  }
};

export const setInRedis = async (key: string, data: string) => {
  if (!redisClient) return;

  try {
    await redisClient.setex(key, REDIS_SESSION_TTL, data);
    logger.debug(`Data saved to Redis: ${key}`);
  } catch (err) {
    logger.error({
      info: "Error inserting/updating data on Redis",
      key,
      err
    });
  }
};

export const getFromRedis = async (key: string) => {
  if (!redisClient) return null;

  try {
    const value = await redisClient.get(key);

    if (!value) return null;

    logger.debug(`Data found on Redis: ${key}`);

    return value;
  } catch (err) {
    logger.error({
      info: "Error getting data from Redis",
      key,
      err
    });
    return null;
  }
};

export const deleteFromRedis = async (key: string) => {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
    logger.debug(`Data deleted from Redis: ${key}`);
  } catch (err) {
    logger.error({
      info: "Error deleting data from Redis",
      key,
      err
    });
  }
};

export const getRedisClient = () => redisClient;

export const closeRedis = async (): Promise<void> => {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  await client.quit();
};
