import { createClient, RedisClientType } from "redis";

export async function getRedis(): Promise<RedisClientType> {
  // 官方推荐：每次都新建并connect
  const redis = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
  await redis.connect();
  return redis;
} 