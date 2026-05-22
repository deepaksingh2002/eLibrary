export function redisConfigFromEnv() {
  const url = process.env.REDIS_URL || process.env.REDIS;
  if (!url?.trim()) {
    return null;
  }

  // BullMQ accepts connection as an object or URL.
  return { url: url.trim() } as any;
}
