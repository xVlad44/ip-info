/**
 * Process-wide singletons, configured from the environment. Kept on
 * globalThis so `next dev` hot reloads do not reset the cache and limiters.
 *
 * Environment (all optional):
 *   IP_PROVIDERS         provider order, default "freeipapi,ipapi"
 *   PROVIDER_TIMEOUT_MS  per-provider request timeout, default 2500
 *   RDNS_TIMEOUT_MS      reverse DNS timeout, default 1500
 *   TRUST_PROXY          loopback | always | never, default loopback (see client-ip.ts)
 */
import type { ProviderName } from '@/lib/ip/types';
import { TtlLru } from './cache';
import { parseTrustMode, type TrustMode } from './client-ip';
import { createLookupService, type CachedLookup, type LookupService } from './lookup-service';
import { createFreeIpApiProvider } from './providers/freeipapi';
import { createIpApiProvider } from './providers/ipapi';
import type { GeoProvider } from './providers/types';
import { RateLimiter } from './rate-limit';
import { createReverseDns } from './rdns';

export interface AppServices {
  service: LookupService;
  /** Per-client limit for the public API and the shareable lookup pages. */
  limiter: RateLimiter;
  trust: TrustMode;
}

export const LIMITS = {
  /** Per client: bursts of 30, refilling at 30 per minute. */
  client: { capacity: 30, refillPerSecond: 0.5 },
  /** All clients together, for provider calls (FreeIPAPI documents 60/min). */
  upstream: { capacity: 30, refillPerSecond: 0.5 },
  cache: { maxEntries: 2000, ttlMs: 6 * 60 * 60 * 1000 },
} as const;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function buildProviders(): GeoProvider[] {
  const timeoutMs = envInt('PROVIDER_TIMEOUT_MS', 2500);
  const registry: Record<ProviderName, () => GeoProvider> = {
    freeipapi: () => createFreeIpApiProvider({ timeoutMs }),
    ipapi: () => createIpApiProvider({ timeoutMs }),
  };
  const names = (process.env.IP_PROVIDERS ?? 'freeipapi,ipapi')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ProviderName => s in registry);
  const unique = [...new Set(names)];
  return (unique.length > 0 ? unique : (['freeipapi', 'ipapi'] as ProviderName[])).map((n) => registry[n]());
}

function build(): AppServices {
  const service = createLookupService({
    providers: buildProviders(),
    cache: new TtlLru<string, CachedLookup>(LIMITS.cache),
    upstreamLimiter: new RateLimiter(LIMITS.upstream),
    reverseDns: createReverseDns({ timeoutMs: envInt('RDNS_TIMEOUT_MS', 1500) }),
    onProviderError: (err) => console.warn(`[lookup] provider failed: ${err.provider} ${err.kind}`),
  });
  return {
    service,
    limiter: new RateLimiter(LIMITS.client),
    trust: parseTrustMode(process.env.TRUST_PROXY),
  };
}

const store = globalThis as typeof globalThis & { __ipInfoServices?: AppServices };

export function getServices(): AppServices {
  store.__ipInfoServices ??= build();
  return store.__ipInfoServices;
}
