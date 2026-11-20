/**
 * Token-bucket rate limiter keyed by client. Each key gets `capacity` tokens
 * that refill continuously at `refillPerSecond`; a request spends one. Buckets
 * live in a bounded LRU, so a flood of distinct keys costs memory up to
 * `maxKeys` and no more. An evicted bucket comes back full, which errs on the
 * side of letting a request through rather than blocking a real user.
 */
import { TtlLru } from './cache';

export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  maxKeys?: number;
  now?: () => number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  /** Whole tokens left after this request. */
  remaining: number;
  /** Seconds until one token is available again (0 when allowed). */
  retryAfterSec: number;
  /** Seconds until the bucket is full again. */
  resetSec: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private readonly buckets: TtlLru<string, Bucket>;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;

  constructor({ capacity, refillPerSecond, maxKeys = 10_000, now = Date.now }: RateLimitOptions) {
    if (capacity < 1) throw new Error('capacity must be >= 1');
    if (refillPerSecond <= 0) throw new Error('refillPerSecond must be > 0');
    this.capacity = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.now = now;
    // A bucket untouched for a full refill period is indistinguishable from a new one.
    const fullRefillMs = Math.ceil(capacity / this.refillPerMs);
    this.buckets = new TtlLru({ maxEntries: maxKeys, ttlMs: fullRefillMs, now });
  }

  take(key: string, cost = 1): RateLimitDecision {
    const now = this.now();
    const prev = this.buckets.get(key);
    const tokens = prev
      ? Math.min(this.capacity, prev.tokens + (now - prev.updatedAt) * this.refillPerMs)
      : this.capacity;

    const allowed = tokens >= cost;
    const after = allowed ? tokens - cost : tokens;
    this.buckets.set(key, { tokens: after, updatedAt: now });

    return {
      allowed,
      limit: this.capacity,
      remaining: Math.floor(after),
      retryAfterSec: allowed ? 0 : Math.ceil((cost - after) / this.refillPerMs / 1000),
      resetSec: Math.ceil((this.capacity - after) / this.refillPerMs / 1000),
    };
  }
}
