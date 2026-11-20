/**
 * FreeIPAPI (https://freeipapi.com). No key, HTTPS, documented free limit of
 * 60 requests/minute, and the site states it is free "for commercial and
 * non-commercial use". Primary provider for that reason.
 *
 * Quirks seen in recorded responses (see __fixtures__):
 * - an unknown/invalid IP is HTTP 200 with every field null;
 * - `timeZones` lists every zone of the country, not the IP's own zone, so it
 *   is only used when it holds exactly one entry;
 * - `asn` is a numeric string ("13335").
 */
import { ProviderError, type FetchLike, type GeoData, type GeoProvider } from './types';
import { assertCanonicalIp, fetchJson, isRecord, num, parseAsn, str, validLatLon } from './http';

export function normalizeFreeIpApi(raw: unknown): GeoData {
  if (!isRecord(raw) || str(raw.ipAddress) === null) {
    throw new ProviderError('freeipapi', 'bad_response', 'no ipAddress in response');
  }
  const zones = Array.isArray(raw.timeZones) ? raw.timeZones.filter((z): z is string => typeof z === 'string') : [];
  const [latitude, longitude] = validLatLon(num(raw.latitude), num(raw.longitude));
  return {
    location: {
      city: str(raw.cityName),
      region: str(raw.regionName),
      regionCode: str(raw.regionCode),
      country: str(raw.countryName),
      countryCode: str(raw.countryCode),
      continentCode: str(raw.continentCode),
      postalCode: str(raw.zipCode),
      latitude,
      longitude,
      timezone: zones.length === 1 ? zones[0] : null,
    },
    network: {
      asn: parseAsn(raw.asn),
      organization: str(raw.asnOrganization),
    },
  };
}

export function createFreeIpApiProvider(opts: { timeoutMs: number; fetchImpl?: FetchLike }): GeoProvider {
  return {
    name: 'freeipapi',
    async lookup(ip) {
      const raw = await fetchJson(`https://free.freeipapi.com/api/v1/json/${assertCanonicalIp(ip)}`, {
        provider: 'freeipapi',
        ...opts,
      });
      return normalizeFreeIpApi(raw);
    },
  };
}
