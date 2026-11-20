/**
 * ipapi.co (https://ipapi.co). No key, HTTPS. Fallback only: its pricing page
 * describes the keyless tier as up to 1000 requests/day, "Suitable for
 * testing / development" and "Not for production use".
 *
 * Errors come back as HTTP 200 with `{ "error": true, "reason": ... }`
 * (e.g. "Invalid IP Address", "Reserved IP Address"), and rate limiting as
 * HTTP 429 with `reason: "RateLimited"`.
 */
import { ProviderError, type FetchLike, type GeoData, type GeoProvider } from './types';
import { assertCanonicalIp, fetchJson, isRecord, num, parseAsn, str, validLatLon } from './http';

export function normalizeIpApi(raw: unknown): GeoData {
  if (!isRecord(raw)) throw new ProviderError('ipapi', 'bad_response', 'response is not an object');
  if (raw.error === true) {
    const reason = str(raw.reason) ?? 'unknown error';
    if (/ratelimit/i.test(reason.replace(/\s/g, ''))) {
      throw new ProviderError('ipapi', 'rate_limited', reason);
    }
    throw new ProviderError('ipapi', 'bad_response', reason);
  }
  if (str(raw.ip) === null) throw new ProviderError('ipapi', 'bad_response', 'no ip in response');
  const [latitude, longitude] = validLatLon(num(raw.latitude), num(raw.longitude));
  return {
    location: {
      city: str(raw.city),
      region: str(raw.region),
      regionCode: str(raw.region_code),
      country: str(raw.country_name),
      countryCode: str(raw.country_code) ?? str(raw.country),
      continentCode: str(raw.continent_code),
      postalCode: str(raw.postal),
      latitude,
      longitude,
      timezone: str(raw.timezone),
    },
    network: {
      asn: parseAsn(raw.asn),
      organization: str(raw.org),
    },
  };
}

export function createIpApiProvider(opts: { timeoutMs: number; fetchImpl?: FetchLike }): GeoProvider {
  return {
    name: 'ipapi',
    async lookup(ip) {
      const raw = await fetchJson(`https://ipapi.co/${assertCanonicalIp(ip)}/json/`, {
        provider: 'ipapi',
        ...opts,
      });
      return normalizeIpApi(raw);
    },
  };
}
