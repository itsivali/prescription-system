import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 500, 5000),
  lazyConnect: true,
});

// Suppress unhandled connection errors — callers handle failures per-call.
redis.on('error', () => {});

// Start connection attempt (non-blocking).
redis.connect().catch(() => {});

/**
 * Atomically reserve a nonce. Returns true if the nonce was unused (and is now
 * marked as consumed for `ttlSeconds`). Returns false if it was already seen,
 * which means the prescription code is being replayed and must be rejected.
 */
export async function consumeNonce(nonce: string, ttlSeconds: number): Promise<boolean> {
  const res = await redis.set(`rx:nonce:${nonce}`, '1', 'EX', ttlSeconds, 'NX');
  return res === 'OK';
}

/**
 * Sliding-window login throttle (per email). Returns the current attempt
 * count for this 15-minute window. Caller decides the threshold.
 *
 * Fails open when Redis is unreachable — login still works but without
 * throttle protection. The rate-limiter middleware provides a fallback.
 */
export async function recordLoginAttempt(email: string): Promise<number> {
  try {
    const key = `auth:fail:${email.toLowerCase()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 15 * 60);
    return count;
  } catch {
    // Redis down — fail open so login isn't blocked entirely.
    return 0;
  }
}

export async function clearLoginAttempts(email: string): Promise<void> {
  try {
    await redis.del(`auth:fail:${email.toLowerCase()}`);
  } catch {
    // Redis down — best-effort, login still succeeds.
  }
}
