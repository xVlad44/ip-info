import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('RateLimiter (token bucket)', () => {
  it('allows a burst up to capacity, then refuses with a retry hint', () => {
    const c = clock();
    const rl = new RateLimiter({ capacity: 3, refillPerSecond: 1, now: c.now });
    expect([rl.take('a'), rl.take('a'), rl.take('a')].map((d) => d.allowed)).toEqual([true, true, true]);
    const denied = rl.take('a');
    expect(denied).toMatchObject({ allowed: false, remaining: 0, retryAfterSec: 1, limit: 3 });
  });

  it('refills continuously', () => {
    const c = clock();
    const rl = new RateLimiter({ capacity: 2, refillPerSecond: 0.5, now: c.now });
    rl.take('a');
    rl.take('a');
    expect(rl.take('a').allowed).toBe(false);
    c.advance(1999);
    expect(rl.take('a').allowed).toBe(false);
    c.advance(1);
    expect(rl.take('a').allowed).toBe(true);
  });

  it('never refills past capacity', () => {
    const c = clock();
    const rl = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: c.now });
    rl.take('a');
    c.advance(60_000);
    expect(rl.take('a').remaining).toBe(1);
  });

  it('keeps clients apart', () => {
    const rl = new RateLimiter({ capacity: 1, refillPerSecond: 0.01 });
    expect(rl.take('a').allowed).toBe(true);
    expect(rl.take('a').allowed).toBe(false);
    expect(rl.take('b').allowed).toBe(true);
  });

  it('bounds memory: the oldest bucket is evicted (and comes back full)', () => {
    const rl = new RateLimiter({ capacity: 1, refillPerSecond: 0.01, maxKeys: 2 });
    rl.take('a');
    rl.take('b');
    rl.take('c'); // evicts a
    expect(rl.take('a').allowed).toBe(true);
  });

  it('reports seconds until the bucket is full', () => {
    const c = clock();
    const rl = new RateLimiter({ capacity: 30, refillPerSecond: 0.5, now: c.now });
    expect(rl.take('a').resetSec).toBe(2);
  });
});
