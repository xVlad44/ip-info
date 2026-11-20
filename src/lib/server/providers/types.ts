import type { GeoLocation, NetworkInfo, ProviderName } from '@/lib/ip/types';

/** What a provider adapter returns after normalising its own JSON. */
export interface GeoData {
  location: GeoLocation;
  network: NetworkInfo;
}

export interface GeoProvider {
  readonly name: ProviderName;
  /** Look up a public IP (canonical form). Throws ProviderError on any failure. */
  lookup(ip: string): Promise<GeoData>;
}

export type ProviderFailure =
  | 'timeout'
  | 'network'
  | 'rate_limited'
  | 'bad_status'
  | 'bad_response';

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly kind: ProviderFailure,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
