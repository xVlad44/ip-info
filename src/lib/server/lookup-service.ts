/**
 * The lookup pipeline:
 *
 *   input -> strict parse -> classify -> (non-public: answer locally)
 *         -> cache -> in-flight dedupe -> upstream budget
 *         -> providers in order, first success wins (+ reverse DNS in parallel)
 *         -> cache -> normalised LookupResult
 *
 * Everything with side effects (providers, DNS, clock) is injected, so the
 * whole pipeline runs in tests without the network.
 */
import { parseIp, unwrapIpv4Mapped } from '@/lib/ip/parse';
import { classifyIp } from '@/lib/ip/ranges';
import type { LookupResult, ProviderName, RangeInfo } from '@/lib/ip/types';
import { TtlLru } from './cache';
import { LookupError } from './errors';
import type { RateLimiter } from './rate-limit';
import { ProviderError, type GeoData, type GeoProvider } from './providers/types';

export interface CachedLookup {
  provider: ProviderName;
  geo: GeoData;
  hostname: string | null;
  retrievedAt: string;
}

export interface LookupServiceDeps {
  providers: GeoProvider[];
  cache: TtlLru<string, CachedLookup>;
  /** Global budget for provider calls, shared by every client. */
  upstreamLimiter?: RateLimiter;
  /** Must never throw; resolves null on failure or timeout. */
  reverseDns?: (ip: string) => Promise<string | null>;
  now?: () => number;
  onProviderError?: (err: ProviderError) => void;
}

export interface LookupService {
  lookup(input: string): Promise<LookupResult>;
}

const DEFAULT_RETRY_SEC = 60;

function preview(input: string): string {
  const s = String(input).trim();
  return s.length > 64 ? `${s.slice(0, 61)}...` : s;
}

export function createLookupService(deps: LookupServiceDeps): LookupService {
  const { providers, cache, upstreamLimiter, reverseDns, now = Date.now, onProviderError } = deps;
  if (providers.length === 0) throw new Error('at least one provider is required');
  const inflight = new Map<string, Promise<CachedLookup>>();

  async function queryProviders(ip: string): Promise<{ provider: ProviderName; geo: GeoData }> {
    if (upstreamLimiter) {
      const budget = upstreamLimiter.take('upstream');
      if (!budget.allowed) {
        throw new LookupError(
          'upstream_rate_limited',
          'The lookup service is at its upstream budget right now. Try again shortly.',
          budget.retryAfterSec,
        );
      }
    }

    const failures: ProviderError[] = [];
    for (const provider of providers) {
      try {
        return { provider: provider.name, geo: await provider.lookup(ip) };
      } catch (err) {
        const failure =
          err instanceof ProviderError
            ? err
            : new ProviderError(provider.name, 'bad_response', err instanceof Error ? err.message : 'unknown error');
        failures.push(failure);
        onProviderError?.(failure);
      }
    }

    if (failures.every((f) => f.kind === 'rate_limited')) {
      const hints = failures.map((f) => f.retryAfterSec).filter((s): s is number => s !== undefined);
      throw new LookupError(
        'upstream_rate_limited',
        'The geolocation providers are rate-limiting this server. Try again in a minute.',
        hints.length > 0 ? Math.max(1, Math.min(...hints)) : DEFAULT_RETRY_SEC,
      );
    }
    throw new LookupError('upstream_unavailable', 'Could not get an answer from the geolocation providers.');
  }

  async function fetchFresh(ip: string): Promise<CachedLookup> {
    const [answer, hostname] = await Promise.all([
      queryProviders(ip),
      reverseDns ? reverseDns(ip) : Promise.resolve(null),
    ]);
    const entry: CachedLookup = {
      provider: answer.provider,
      geo: answer.geo,
      hostname,
      retrievedAt: new Date(now()).toISOString(),
    };
    cache.set(ip, entry);
    return entry;
  }

  return {
    async lookup(input) {
      const parsed = parseIp(input);
      if (!parsed) {
        throw new LookupError('invalid_ip', `"${preview(input)}" is not a valid IPv4 or IPv6 address.`);
      }
      // ::ffff:a.b.c.d is reported as the IPv4 address it carries.
      const ip = unwrapIpv4Mapped(parsed) ?? parsed;
      const { scope, range } = classifyIp(ip);
      const rangeInfo: RangeInfo | null = range
        ? { cidr: range.cidr, name: range.name, rfc: range.rfc, note: range.note }
        : null;
      const base = { ip: ip.canonical, version: ip.version, scope, range: rangeInfo };

      if (scope !== 'public') {
        return {
          ...base,
          hostname: null,
          location: null,
          network: null,
          source: { provider: 'local', cached: false, retrievedAt: new Date(now()).toISOString() },
        };
      }

      const key = ip.canonical;
      let entry = cache.get(key);
      const cached = entry !== undefined;
      if (!entry) {
        // Concurrent lookups of the same IP share one upstream request.
        let pending = inflight.get(key);
        if (!pending) {
          pending = fetchFresh(key).finally(() => inflight.delete(key));
          inflight.set(key, pending);
        }
        entry = await pending;
      }

      return {
        ...base,
        hostname: entry.hostname,
        location: entry.geo.location,
        network: entry.geo.network,
        source: { provider: entry.provider, cached, retrievedAt: entry.retrievedAt },
      };
    },
  };
}
