import { describe, expect, it, vi } from 'vitest';
import freeIpApi1111 from '@/lib/ip/__fixtures__/freeipapi-1.1.1.1.json';
import freeIpApiV6 from '@/lib/ip/__fixtures__/freeipapi-2606-4700-4700--1111.json';
import freeIpApiInvalid from '@/lib/ip/__fixtures__/freeipapi-invalid.json';
import ipApi1111 from '@/lib/ip/__fixtures__/ipapi-1.1.1.1.json';
import ipApiInvalid from '@/lib/ip/__fixtures__/ipapi-invalid.json';
import ipApiRateLimited from '@/lib/ip/__fixtures__/ipapi-ratelimited.json';
import { createFreeIpApiProvider, normalizeFreeIpApi } from './freeipapi';
import { assertCanonicalIp, fetchJson, parseAsn, parseRetryAfter } from './http';
import { createIpApiProvider, normalizeIpApi } from './ipapi';
import { ProviderError, type FetchLike } from './types';

function expectProviderError(fn: () => unknown, kind: ProviderError['kind']) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe(kind);
    return;
  }
  throw new Error('expected a ProviderError');
}

describe('normalizeFreeIpApi (recorded fixtures)', () => {
  it('maps the 1.1.1.1 response', () => {
    expect(normalizeFreeIpApi(freeIpApi1111)).toEqual({
      location: {
        city: 'Sydney',
        region: 'New South Wales',
        regionCode: 'NSW',
        country: 'Australia',
        countryCode: 'AU',
        continentCode: 'OC',
        postalCode: null,
        latitude: -33.8688,
        longitude: 151.209,
        // 12 Australian zones in timeZones: ambiguous, so no timezone is claimed
        timezone: null,
      },
      network: { asn: 13335, organization: 'Cloudflare, Inc.' },
    });
  });

  it('maps an IPv6 response', () => {
    const geo = normalizeFreeIpApi(freeIpApiV6);
    expect(geo.location.countryCode).toBe('US');
    expect(geo.network.asn).toBe(13335);
  });

  it('treats the all-null body it returns for bad input as a bad response', () => {
    expectProviderError(() => normalizeFreeIpApi(freeIpApiInvalid), 'bad_response');
  });

  it('uses timeZones only when it holds exactly one zone', () => {
    const geo = normalizeFreeIpApi({ ...freeIpApi1111, timeZones: ['Europe/Bucharest'] });
    expect(geo.location.timezone).toBe('Europe/Bucharest');
  });

  it('drops out-of-range coordinates', () => {
    const geo = normalizeFreeIpApi({ ...freeIpApi1111, latitude: 123, longitude: 10 });
    expect([geo.location.latitude, geo.location.longitude]).toEqual([null, null]);
  });
});

describe('normalizeIpApi (recorded fixtures)', () => {
  it('maps the 1.1.1.1 response', () => {
    expect(normalizeIpApi(ipApi1111)).toEqual({
      location: {
        city: 'Sydney',
        region: 'New South Wales',
        regionCode: 'NSW',
        country: 'Australia',
        countryCode: 'AU',
        continentCode: 'OC',
        postalCode: '2000',
        latitude: -33.859336,
        longitude: 151.203624,
        timezone: 'Australia/Sydney',
      },
      network: { asn: 13335, organization: 'Cloudflare, Inc.' },
    });
  });

  it('maps {"error": true} bodies to bad_response', () => {
    expectProviderError(() => normalizeIpApi(ipApiInvalid), 'bad_response');
  });

  it('maps the documented RateLimited body to rate_limited', () => {
    expectProviderError(() => normalizeIpApi(ipApiRateLimited), 'rate_limited');
  });

  it('rejects non-objects', () => {
    expectProviderError(() => normalizeIpApi('<html>'), 'bad_response');
  });
});

describe('fetchJson', () => {
  const ok = (body: unknown, init?: ResponseInit) => async () => new Response(JSON.stringify(body), init);

  it('returns parsed JSON', async () => {
    await expect(fetchJson('https://x.test', { provider: 'ipapi', timeoutMs: 100, fetchImpl: ok({ a: 1 }) })).resolves.toEqual({ a: 1 });
  });

  it('maps HTTP 429 to rate_limited with Retry-After', async () => {
    const fetchImpl = ok({}, { status: 429, headers: { 'retry-after': '42' } });
    await expect(fetchJson('https://x.test', { provider: 'ipapi', timeoutMs: 100, fetchImpl })).rejects.toMatchObject({
      kind: 'rate_limited',
      retryAfterSec: 42,
    });
  });

  it('maps other non-2xx statuses to bad_status', async () => {
    const fetchImpl = ok({}, { status: 503 });
    await expect(fetchJson('https://x.test', { provider: 'ipapi', timeoutMs: 100, fetchImpl })).rejects.toMatchObject({ kind: 'bad_status' });
  });

  it('maps a non-JSON body to bad_response', async () => {
    const fetchImpl: FetchLike = async () => new Response('<html>oops</html>');
    await expect(fetchJson('https://x.test', { provider: 'ipapi', timeoutMs: 100, fetchImpl })).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('maps a thrown fetch to network', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(fetchJson('https://x.test', { provider: 'ipapi', timeoutMs: 100, fetchImpl })).rejects.toMatchObject({ kind: 'network' });
  });

  it('aborts after the timeout and reports timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      const pending = fetchJson('https://x.test', { provider: 'freeipapi', timeoutMs: 2500, fetchImpl });
      const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
      await vi.advanceTimersByTimeAsync(2500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('provider adapters', () => {
  it('build the provider URL from the canonical IP and normalise the answer', async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(url.includes('freeipapi') ? freeIpApi1111 : ipApi1111));
    };
    await createFreeIpApiProvider({ timeoutMs: 100, fetchImpl }).lookup('1.1.1.1');
    await createIpApiProvider({ timeoutMs: 100, fetchImpl }).lookup('2606:4700:4700::1111');
    expect(urls).toEqual([
      'https://free.freeipapi.com/api/v1/json/1.1.1.1',
      'https://ipapi.co/2606:4700:4700::1111/json/',
    ]);
  });

  it('refuse to put anything but a canonical IP in the URL', () => {
    expect(() => assertCanonicalIp('1.1.1.1/../../admin')).toThrow();
    expect(() => assertCanonicalIp('1.1.1.1?x=1')).toThrow();
    expect(assertCanonicalIp('2001:db8::1')).toBe('2001:db8::1');
  });
});

describe('helpers', () => {
  it('parseAsn accepts AS-prefixed, numeric strings and numbers', () => {
    expect(parseAsn('AS13335')).toBe(13335);
    expect(parseAsn('13335')).toBe(13335);
    expect(parseAsn(15169)).toBe(15169);
    expect(parseAsn('ASX')).toBeNull();
    expect(parseAsn(null)).toBeNull();
    expect(parseAsn('0')).toBeNull();
  });

  it('parseRetryAfter reads seconds and HTTP dates', () => {
    const now = Date.parse('2026-11-21T00:00:00Z');
    expect(parseRetryAfter('120', now)).toBe(120);
    expect(parseRetryAfter('Sat, 21 Nov 2026 00:01:00 GMT', now)).toBe(60);
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });
});
