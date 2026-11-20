/**
 * A small LRU cache with per-entry TTL. A Map keeps insertion order, so
 * re-inserting on read moves an entry to the "most recent" end and the first
 * key is always the least recently used. O(1) get/set, no timers: expired
 * entries are dropped lazily when read or when they reach the LRU end.
 */
export interface TtlLruOptions {
  maxEntries: number;
  ttlMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlLru<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ maxEntries, ttlMs, now = Date.now }: TtlLruOptions) {
    if (maxEntries < 1) throw new Error('maxEntries must be >= 1');
    if (ttlMs <= 0) throw new Error('ttlMs must be > 0');
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency without touching the expiry.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number = this.ttlMs): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
