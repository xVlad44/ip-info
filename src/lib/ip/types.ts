/**
 * The one response shape every provider is normalised into. The UI, the API
 * and the docs page all speak this type; provider-specific JSON never leaves
 * the provider adapters.
 */
import type { IpVersion } from './parse';
import type { IpScope } from './ranges';

export type ProviderName = 'freeipapi' | 'ipapi';
export type ResultSource = ProviderName | 'local';

export interface GeoLocation {
  city: string | null;
  region: string | null;
  regionCode: string | null;
  country: string | null;
  /** ISO 3166-1 alpha-2. */
  countryCode: string | null;
  continentCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** IANA zone name, only when the provider gives one unambiguous zone. */
  timezone: string | null;
}

export interface NetworkInfo {
  asn: number | null;
  organization: string | null;
}

export interface RangeInfo {
  cidr: string;
  name: string;
  rfc: string;
  note: string;
}

export interface LookupResult {
  /** Canonical text form (dotted quad, or RFC 5952 for IPv6). */
  ip: string;
  version: IpVersion;
  scope: IpScope;
  /** The special-purpose range the address is in; null for public addresses. */
  range: RangeInfo | null;
  /** Reverse DNS (PTR) name; looked up for public addresses only. */
  hostname: string | null;
  /** Null when the address has no public location (non-public scope). */
  location: GeoLocation | null;
  network: NetworkInfo | null;
  source: {
    provider: ResultSource;
    cached: boolean;
    /** ISO 8601 time the data was fetched from the provider (or computed locally). */
    retrievedAt: string;
  };
}

export type ErrorCode =
  | 'invalid_ip'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'upstream_unavailable'
  | 'client_ip_unknown'
  | 'internal';

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    /** Seconds until a retry can succeed (429 only). */
    retryAfter?: number;
  };
}

export const ERROR_STATUS: Record<ErrorCode, number> = {
  invalid_ip: 400,
  rate_limited: 429,
  upstream_rate_limited: 429,
  upstream_unavailable: 502,
  client_ip_unknown: 500,
  internal: 500,
};
