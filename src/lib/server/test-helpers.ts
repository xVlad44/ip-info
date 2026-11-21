/** Shared fakes for the server tests. Not imported by application code. */
import freeIpApi1111 from '@/lib/ip/__fixtures__/freeipapi-1.1.1.1.json';
import ipApi1111 from '@/lib/ip/__fixtures__/ipapi-1.1.1.1.json';
import type { ProviderName } from '@/lib/ip/types';
import { TtlLru } from './cache';
import { createLookupService, type CachedLookup, type LookupServiceDeps } from './lookup-service';
import { normalizeFreeIpApi } from './providers/freeipapi';
import { normalizeIpApi } from './providers/ipapi';
import { ProviderError, type GeoData, type GeoProvider, type ProviderFailure } from './providers/types';

export const GEO_FREEIPAPI: GeoData = normalizeFreeIpApi(freeIpApi1111);
export const GEO_IPAPI: GeoData = normalizeIpApi(ipApi1111);

export interface FakeProvider extends GeoProvider {
  calls: string[];
}

/** A provider that answers from a fixture, or fails with the given kind. */
export function fakeProvider(
  name: ProviderName,
  behaviour: GeoData | { fail: ProviderFailure; retryAfterSec?: number } | (() => Promise<GeoData>),
): FakeProvider {
  const calls: string[] = [];
  return {
    name,
    calls,
    async lookup(ip) {
      calls.push(ip);
      if (typeof behaviour === 'function') return behaviour();
      if ('fail' in behaviour) throw new ProviderError(name, behaviour.fail, 'fake failure', behaviour.retryAfterSec);
      return behaviour;
    },
  };
}

export function makeService(overrides: Partial<LookupServiceDeps> = {}) {
  return createLookupService({
    providers: [fakeProvider('freeipapi', GEO_FREEIPAPI)],
    cache: new TtlLru<string, CachedLookup>({ maxEntries: 100, ttlMs: 60_000 }),
    now: () => Date.parse('2026-11-21T00:00:00Z'),
    ...overrides,
  });
}
