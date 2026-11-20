/**
 * HTTP layer for the API routes. Built as factories over injected services so
 * tests can drive them with plain `Request` objects and fake providers.
 */
import type { LookupResult } from '@/lib/ip/types';
import { resolveClientIp, type TrustMode } from './client-ip';
import { LookupError, toLookupError } from './errors';
import type { LookupService } from './lookup-service';
import type { RateLimitDecision, RateLimiter } from './rate-limit';

export interface HandlerDeps {
  service: LookupService;
  limiter: RateLimiter;
  trust: TrustMode;
}

type Headers = Record<string, string>;

function rateLimitHeaders(d: RateLimitDecision): Headers {
  return {
    'RateLimit-Limit': String(d.limit),
    'RateLimit-Remaining': String(d.remaining),
    'RateLimit-Reset': String(d.resetSec),
  };
}

function json(body: unknown, status: number, headers: Headers): Response {
  return Response.json(body, { status, headers });
}

export function errorResponse(err: LookupError, headers: Headers = {}): Response {
  if (err.code === 'internal') console.error('[api] internal error');
  return json(err.toJSON(), err.status, {
    ...headers,
    'Cache-Control': 'no-store',
    ...(err.retryAfterSec !== undefined ? { 'Retry-After': String(err.retryAfterSec) } : {}),
  });
}

/** Rate-limit by client, or answer 429. Returns the headers to attach either way. */
function admit(request: Request, deps: HandlerDeps): { client: string | null; headers: Headers; denied?: Response } {
  const client = resolveClientIp(request.headers, deps.trust);
  const decision = deps.limiter.take(client?.ip ?? 'unknown');
  const headers = rateLimitHeaders(decision);
  if (!decision.allowed) {
    const err = new LookupError(
      'rate_limited',
      `Too many requests. Try again in ${decision.retryAfterSec} s.`,
      decision.retryAfterSec,
    );
    return { client: client?.ip ?? null, headers, denied: errorResponse(err, headers) };
  }
  return { client: client?.ip ?? null, headers };
}

async function respondWithLookup(deps: HandlerDeps, ip: string, headers: Headers, cacheControl: string) {
  try {
    const result: LookupResult = await deps.service.lookup(ip);
    return json(result, 200, { ...headers, 'Cache-Control': cacheControl });
  } catch (err) {
    return errorResponse(toLookupError(err), headers);
  }
}

/** GET /api/lookup?ip=<address> */
export function createLookupHandler(deps: HandlerDeps) {
  return async function GET(request: Request): Promise<Response> {
    const gate = admit(request, deps);
    if (gate.denied) return gate.denied;

    const ip = new URL(request.url).searchParams.get('ip');
    if (ip === null || ip.trim() === '') {
      return errorResponse(
        new LookupError('invalid_ip', 'Pass an address as ?ip=, for example /api/lookup?ip=1.1.1.1'),
        gate.headers,
      );
    }
    return respondWithLookup(deps, ip, gate.headers, 'private, max-age=300');
  };
}

/** GET /api/me (JSON) or /api/me?format=text (just the address). */
export function createMeHandler(deps: HandlerDeps) {
  return async function GET(request: Request): Promise<Response> {
    const gate = admit(request, deps);
    if (gate.denied) return gate.denied;

    if (!gate.client) {
      return errorResponse(new LookupError('client_ip_unknown', 'Could not determine the client address.'), gate.headers);
    }
    if (new URL(request.url).searchParams.get('format') === 'text') {
      return new Response(`${gate.client}\n`, {
        status: 200,
        headers: { ...gate.headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return respondWithLookup(deps, gate.client, gate.headers, 'no-store');
  };
}
