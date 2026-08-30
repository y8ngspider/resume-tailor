type RateRecord = { count: number; resetAt: number };
const memory = new Map<string, RateRecord>();

export async function checkRateLimit(identifier: string, limit = 5): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const key = `proofread:${new Date().toISOString().slice(0, 10)}:${identifier}`;
  if (url && token) {
    try {
      const response = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, 86400, "NX"]]),
      });
      const result = await response.json() as Array<{ result?: number }>;
      const count = Number(result[0]?.result ?? limit + 1);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    } catch { /* fall through to isolate-local protection */ }
  }
  const now = Date.now();
  const current = memory.get(key);
  const record = !current || current.resetAt < now ? { count: 0, resetAt: now + 86_400_000 } : current;
  record.count += 1;
  memory.set(key, record);
  return { allowed: record.count <= limit, remaining: Math.max(0, limit - record.count) };
}
