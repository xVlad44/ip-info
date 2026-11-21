import { describe, expect, it } from 'vitest';
import { TtlLru } from './cache';

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('TtlLru', () => {
  it('returns values until they expire', () => {
    const c = clock();
    const cache = new TtlLru<string, number>({ maxEntries: 10, ttlMs: 1000, now: c.now });
    cache.set('a', 1);
    c.advance(999);
    expect(cache.get('a')).toBe(1);
    c.advance(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TtlLru<string, number>({ maxEntries: 2, ttlMs: 1000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a is now more recent than b
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('reading does not extend the expiry', () => {
    const c = clock();
    const cache = new TtlLru<string, number>({ maxEntries: 10, ttlMs: 1000, now: c.now });
    cache.set('a', 1);
    c.advance(600);
    cache.get('a');
    c.advance(600);
    expect(cache.get('a')).toBeUndefined();
  });

  it('overwriting resets value and expiry', () => {
    const c = clock();
    const cache = new TtlLru<string, number>({ maxEntries: 10, ttlMs: 1000, now: c.now });
    cache.set('a', 1);
    c.advance(900);
    cache.set('a', 2);
    c.advance(900);
    expect(cache.get('a')).toBe(2);
  });

  it('accepts a per-entry TTL', () => {
    const c = clock();
    const cache = new TtlLru<string, number>({ maxEntries: 10, ttlMs: 1000, now: c.now });
    cache.set('short', 1, 10);
    c.advance(11);
    expect(cache.get('short')).toBeUndefined();
  });

  it('rejects nonsense options', () => {
    expect(() => new TtlLru({ maxEntries: 0, ttlMs: 1 })).toThrow();
    expect(() => new TtlLru({ maxEntries: 1, ttlMs: 0 })).toThrow();
  });
});
