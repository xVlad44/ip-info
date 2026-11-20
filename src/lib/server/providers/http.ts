import type { ProviderName } from '@/lib/ip/types';
import { ProviderError, type FetchLike } from './types';

export interface FetchJsonOptions {
  provider: ProviderName;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

const USER_AGENT = 'ip-info/1.0';

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/**
 * GET a JSON document with a hard timeout, mapping every failure mode to a
 * typed ProviderError so callers can decide between "try the next provider"
 * and "tell the user to slow down".
 */
export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<unknown> {
  const { provider, timeoutMs, fetchImpl = fetch } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      cache: 'no-store',
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ProviderError(provider, 'timeout', `no response within ${timeoutMs} ms`);
    }
    throw new ProviderError(provider, 'network', err instanceof Error ? err.message : 'request failed');
  }

  try {
    if (res.status === 429) {
      throw new ProviderError(provider, 'rate_limited', 'HTTP 429', parseRetryAfter(res.headers.get('retry-after')));
    }
    if (!res.ok) {
      throw new ProviderError(provider, 'bad_status', `HTTP ${res.status}`);
    }
    try {
      return await res.json();
    } catch {
      if (controller.signal.aborted) {
        throw new ProviderError(provider, 'timeout', `body not received within ${timeoutMs} ms`);
      }
      throw new ProviderError(provider, 'bad_response', 'body is not JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

// Small typed readers for untrusted JSON.
export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** "AS13335", "13335" or 13335 -> 13335. */
export function parseAsn(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const m = /^(?:AS)?(\d{1,10})$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 4294967295 ? n : null;
}

export function validLatLon(lat: number | null, lon: number | null): [number | null, number | null] {
  if (lat === null || lon === null) return [null, null];
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return [null, null];
  return [lat, lon];
}

/**
 * Provider URLs embed the IP in the path. Callers pass the parser's canonical
 * form, which only ever contains hex digits, dots and colons; refuse anything
 * else so a future caller cannot smuggle a path or query into the URL.
 */
export function assertCanonicalIp(ip: string): string {
  if (!/^[0-9a-f.:]{2,45}$/.test(ip)) throw new Error(`refusing non-canonical IP in provider URL: ${ip}`);
  return ip;
}
