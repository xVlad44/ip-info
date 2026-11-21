/**
 * Lookups for server-rendered pages. Same service, cache and limits as the
 * API; React's cache() makes generateMetadata and the page share one lookup
 * (and one rate-limit token) per request.
 */
import { cache } from 'react';
import { headers } from 'next/headers';
import type { ApiError, LookupResult } from '@/lib/ip/types';
import { resolveClientIp, type ClientIp } from './client-ip';
import { LookupError, toLookupError } from './errors';
import { getServices } from './instance';

export type PageLookup = { ok: true; result: LookupResult } | ({ ok: false } & ApiError);

function failure(err: unknown): PageLookup {
  return { ok: false, ...toLookupError(err).toJSON() };
}

/** Who is asking, per the trust model in client-ip.ts. */
export const clientIdentity = cache(async (): Promise<ClientIp | null> => {
  const { trust } = getServices();
  return resolveClientIp(await headers(), trust);
});

async function clientIp(): Promise<string | null> {
  return (await clientIdentity())?.ip ?? null;
}

/** Look up an arbitrary address for /lookup/[ip]; counts against the client's rate limit. */
export const lookupForPage = cache(async (ip: string): Promise<PageLookup> => {
  const { service, limiter } = getServices();
  const decision = limiter.take((await clientIp()) ?? 'unknown');
  if (!decision.allowed) {
    return failure(new LookupError('rate_limited', 'You have made a lot of lookups in a short time.', decision.retryAfterSec));
  }
  try {
    return { ok: true, result: await service.lookup(ip) };
  } catch (err) {
    return failure(err);
  }
});

/** Look up the visitor's own address (home and /tools/my-ip). */
export const lookupSelf = cache(async (): Promise<PageLookup> => {
  const ip = await clientIp();
  if (!ip) return failure(new LookupError('client_ip_unknown', 'The request carried no usable client address.'));
  try {
    return { ok: true, result: await getServices().service.lookup(ip) };
  } catch (err) {
    return failure(err);
  }
});
