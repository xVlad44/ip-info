/**
 * Who is the client? The trust model, in one place.
 *
 * Production: Cloudflare -> cloudflared tunnel -> nginx (localhost:80) ->
 * `next start`. The app's TCP peer is therefore always 127.0.0.1 and the
 * visitor's address arrives in headers: Cloudflare sets CF-Connecting-IP,
 * and nginx may add X-Forwarded-For.
 *
 * Headers are only as trustworthy as whoever set them. Anyone who can open a
 * TCP connection to the app port directly (the Pi listens on the LAN) can
 * send any CF-Connecting-IP they like. So forwarded headers are believed only
 * when the direct peer is loopback, i.e. the request came through a proxy on
 * this machine. Otherwise the peer address itself is the client.
 *
 * Next's route handlers do not expose the socket, and Next only fills
 * X-Forwarded-For from the socket when the header is absent, so a direct
 * client could forge that too. src/instrumentation.ts stamps the real socket
 * peer onto PEER_HEADER (after deleting any client-supplied copy) before Next
 * sees the request; this module reads it.
 */
import { parseIp, unwrapIpv4Mapped, type ParsedIp } from '@/lib/ip/parse';
import { isLoopback } from '@/lib/ip/ranges';

export const PEER_HEADER = 'x-ip-info-peer';

/**
 * loopback (default): trust forwarded headers only from a loopback peer.
 * always: trust them unconditionally (only safe if the app port is unreachable
 *         except through the proxy, e.g. bound to 127.0.0.1).
 * never:  ignore them; the TCP peer is the client.
 */
export type TrustMode = 'loopback' | 'always' | 'never';

export interface HeaderReader {
  get(name: string): string | null;
}

export type ClientIpSource = 'cf-connecting-ip' | 'x-forwarded-for' | 'x-real-ip' | 'peer';

export interface ClientIp {
  ip: string;
  via: ClientIpSource;
}

export function parseTrustMode(value: string | undefined): TrustMode {
  return value === 'always' || value === 'never' ? value : 'loopback';
}

function normalise(ip: ParsedIp): ParsedIp {
  return unwrapIpv4Mapped(ip) ?? ip;
}

function parseHeaderIp(value: string | null): ParsedIp | null {
  if (!value) return null;
  const parsed = parseIp(value);
  return parsed ? normalise(parsed) : null;
}

/**
 * X-Forwarded-For is "client, proxy1, proxy2"; each proxy appends the address
 * it received the request from. Entries to the left of the first proxy we
 * trust are client-controlled, so read right to left and take the first
 * address that is not one of our own (loopback) hops. Stop at anything that
 * does not parse: past that point the chain cannot be trusted.
 */
function fromForwardedFor(value: string | null): ParsedIp | null {
  if (!value) return null;
  const hops = value.split(',').map((h) => h.trim()).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = parseHeaderIp(hops[i]);
    if (!hop) return null;
    if (!isLoopback(hop)) return hop;
  }
  return null;
}

export function resolveClientIp(headers: HeaderReader, mode: TrustMode = 'loopback'): ClientIp | null {
  const peer = parseHeaderIp(headers.get(PEER_HEADER));
  const trustForwarded = mode === 'always' || (mode === 'loopback' && peer !== null && isLoopback(peer));

  if (trustForwarded) {
    const cf = parseHeaderIp(headers.get('cf-connecting-ip'));
    if (cf) return { ip: cf.canonical, via: 'cf-connecting-ip' };
    const xff = fromForwardedFor(headers.get('x-forwarded-for'));
    if (xff) return { ip: xff.canonical, via: 'x-forwarded-for' };
    const real = parseHeaderIp(headers.get('x-real-ip'));
    if (real && !isLoopback(real)) return { ip: real.canonical, via: 'x-real-ip' };
  }

  return peer ? { ip: peer.canonical, via: 'peer' } : null;
}
