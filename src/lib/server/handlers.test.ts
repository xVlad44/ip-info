import { describe, expect, it } from 'vitest';
import { apiErrorSchema, lookupResultSchema } from '@/lib/ip/schema';
import { validate } from '@/lib/ip/schema-validate';
import { PEER_HEADER } from './client-ip';
import { createLookupHandler, createMeHandler, type HandlerDeps } from './handlers';
import { RateLimiter } from './rate-limit';
import { GEO_FREEIPAPI, fakeProvider, makeService } from './test-helpers';

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    service: makeService({ reverseDns: async () => 'one.one.one.one' }),
    limiter: new RateLimiter({ capacity: 30, refillPerSecond: 0.5 }),
    trust: 'loopback',
    ...overrides,
  };
}

function get(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { headers: { [PEER_HEADER]: '127.0.0.1', ...headers } });
}

describe('GET /api/lookup', () => {
  it('200: returns a LookupResult that matches the published schema', async () => {
    const res = await createLookupHandler(deps())(get('/api/lookup?ip=1.1.1.1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('ratelimit-limit')).toBe('30');
    expect(res.headers.get('ratelimit-remaining')).toBe('29');
    const body = await res.json();
    expect(validate(lookupResultSchema, body)).toEqual([]);
    expect(body).toMatchObject({ ip: '1.1.1.1', hostname: 'one.one.one.one', network: GEO_FREEIPAPI.network });
  });

  it('200: private addresses validate too (null location and network)', async () => {
    const body = await (await createLookupHandler(deps())(get('/api/lookup?ip=fd00::1'))).json();
    expect(body.scope).toBe('private');
    expect(validate(lookupResultSchema, body)).toEqual([]);
  });

  it('400: missing ?ip=', async () => {
    const res = await createLookupHandler(deps())(get('/api/lookup'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_ip');
    expect(validate(apiErrorSchema, body)).toEqual([]);
  });

  it('400: garbage input, with a no-store error body', async () => {
    const res = await createLookupHandler(deps())(get('/api/lookup?ip=' + encodeURIComponent('1.1.1.1; rm -rf /')));
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).error.code).toBe('invalid_ip');
  });

  it('429: per-client limit, with Retry-After, keyed by the trusted client address', async () => {
    const d = deps({ limiter: new RateLimiter({ capacity: 2, refillPerSecond: 0.1 }) });
    const handler = createLookupHandler(d);
    const asClient = (ip: string) => get('/api/lookup?ip=10.0.0.1', { 'cf-connecting-ip': ip });
    expect((await handler(asClient('203.0.113.1'))).status).toBe(200);
    expect((await handler(asClient('203.0.113.1'))).status).toBe(200);
    const limited = await handler(asClient('203.0.113.1'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('10');
    const body = await limited.json();
    expect(body.error).toMatchObject({ code: 'rate_limited', retryAfter: 10 });
    expect(validate(apiErrorSchema, body)).toEqual([]);
    // a different visitor behind the same proxy has their own bucket
    expect((await handler(asClient('203.0.113.2'))).status).toBe(200);
  });

  it('429: upstream rate limiting is passed on with Retry-After', async () => {
    const service = makeService({ providers: [fakeProvider('freeipapi', { fail: 'rate_limited', retryAfterSec: 7 })] });
    const res = await createLookupHandler(deps({ service }))(get('/api/lookup?ip=1.1.1.1'));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('7');
    expect((await res.json()).error.code).toBe('upstream_rate_limited');
  });

  it('502: every provider down', async () => {
    const service = makeService({ providers: [fakeProvider('freeipapi', { fail: 'timeout' }), fakeProvider('ipapi', { fail: 'bad_status' })] });
    const res = await createLookupHandler(deps({ service }))(get('/api/lookup?ip=1.1.1.1'));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('upstream_unavailable');
  });

  it('500: unexpected errors are reported generically', async () => {
    const service = { lookup: async () => Promise.reject(new Error('secret internals')) };
    const res = await createLookupHandler(deps({ service }))(get('/api/lookup?ip=1.1.1.1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('internal');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

describe('GET /api/me', () => {
  it('returns the trusted client address as plain text', async () => {
    const res = await createMeHandler(deps())(get('/api/me?format=text', { 'cf-connecting-ip': '1.1.1.1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('1.1.1.1\n');
  });

  it('returns a full LookupResult as JSON', async () => {
    const res = await createMeHandler(deps())(get('/api/me', { 'cf-connecting-ip': '1.1.1.1' }));
    const body = await res.json();
    expect(body.ip).toBe('1.1.1.1');
    expect(validate(lookupResultSchema, body)).toEqual([]);
  });

  it('does not let a direct (non-loopback) client spoof its address', async () => {
    const req = new Request('http://localhost/api/me?format=text', {
      headers: { [PEER_HEADER]: '192.168.0.50', 'cf-connecting-ip': '1.1.1.1' },
    });
    expect(await (await createMeHandler(deps())(req)).text()).toBe('192.168.0.50\n');
  });

  it('500 client_ip_unknown when the address cannot be determined', async () => {
    const res = await createMeHandler(deps())(new Request('http://localhost/api/me'));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('client_ip_unknown');
  });
});
