import { describe, expect, it } from 'vitest';
import { LookupError } from './errors';
import { RateLimiter } from './rate-limit';
import { GEO_FREEIPAPI, GEO_IPAPI, fakeProvider, makeService } from './test-helpers';

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(LookupError);
    return err as LookupError;
  }
  throw new Error('expected the lookup to fail');
}

describe('lookup service', () => {
  it('rejects invalid input before any provider call', async () => {
    const provider = fakeProvider('freeipapi', GEO_FREEIPAPI);
    const err = await codeOf(makeService({ providers: [provider] }).lookup('999.1.1.1'));
    expect(err.code).toBe('invalid_ip');
    expect(err.status).toBe(400);
    expect(provider.calls).toEqual([]);
  });

  it('answers private and reserved space locally', async () => {
    const provider = fakeProvider('freeipapi', GEO_FREEIPAPI);
    const reverseDns = async () => 'should-not-be-called';
    const r = await makeService({ providers: [provider], reverseDns }).lookup('192.168.1.1');
    expect(r).toMatchObject({
      ip: '192.168.1.1',
      scope: 'private',
      range: { cidr: '192.168.0.0/16', rfc: 'RFC 1918' },
      location: null,
      network: null,
      hostname: null,
      source: { provider: 'local', cached: false },
    });
    expect(provider.calls).toEqual([]);
  });

  it('returns the first provider’s normalised answer plus reverse DNS', async () => {
    const r = await makeService({ reverseDns: async () => 'one.one.one.one' }).lookup('1.1.1.1');
    expect(r).toMatchObject({
      ip: '1.1.1.1',
      version: 4,
      scope: 'public',
      range: null,
      hostname: 'one.one.one.one',
      location: GEO_FREEIPAPI.location,
      network: GEO_FREEIPAPI.network,
      source: { provider: 'freeipapi', cached: false, retrievedAt: '2026-11-21T00:00:00.000Z' },
    });
  });

  it('canonicalises the address and reports IPv4-mapped input as IPv4', async () => {
    const provider = fakeProvider('freeipapi', GEO_FREEIPAPI);
    const service = makeService({ providers: [provider] });
    expect((await service.lookup('2606:4700:4700:0:0:0:0:1111')).ip).toBe('2606:4700:4700::1111');
    expect((await service.lookup('::ffff:8.8.8.8')).ip).toBe('8.8.8.8');
    expect(provider.calls).toEqual(['2606:4700:4700::1111', '8.8.8.8']);
  });

  it('falls back to the next provider when one fails', async () => {
    const first = fakeProvider('freeipapi', { fail: 'timeout' });
    const second = fakeProvider('ipapi', GEO_IPAPI);
    const errors: string[] = [];
    const r = await makeService({ providers: [first, second], onProviderError: (e) => errors.push(e.kind) }).lookup('1.1.1.1');
    expect(r.source.provider).toBe('ipapi');
    expect(r.location?.timezone).toBe('Australia/Sydney');
    expect(errors).toEqual(['timeout']);
  });

  it('reports upstream_rate_limited (429) when every provider is rate limited', async () => {
    const err = await codeOf(
      makeService({
        providers: [fakeProvider('freeipapi', { fail: 'rate_limited', retryAfterSec: 30 }), fakeProvider('ipapi', { fail: 'rate_limited' })],
      }).lookup('1.1.1.1'),
    );
    expect(err).toMatchObject({ code: 'upstream_rate_limited', retryAfterSec: 30 });
    expect(err.status).toBe(429);
  });

  it('reports upstream_unavailable (502) when providers fail otherwise', async () => {
    const err = await codeOf(
      makeService({
        providers: [fakeProvider('freeipapi', { fail: 'rate_limited' }), fakeProvider('ipapi', { fail: 'network' })],
      }).lookup('1.1.1.1'),
    );
    expect(err.code).toBe('upstream_unavailable');
    expect(err.status).toBe(502);
  });

  it('wraps unexpected provider exceptions instead of leaking them', async () => {
    const broken = fakeProvider('freeipapi', async () => {
      throw new Error('boom');
    });
    const err = await codeOf(makeService({ providers: [broken] }).lookup('1.1.1.1'));
    expect(err.code).toBe('upstream_unavailable');
  });

  it('serves repeat lookups from the cache', async () => {
    const provider = fakeProvider('freeipapi', GEO_FREEIPAPI);
    const service = makeService({ providers: [provider] });
    await service.lookup('1.1.1.1');
    const second = await service.lookup('1.1.1.1');
    expect(second.source.cached).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });

  it('shares one upstream call between concurrent lookups of the same IP', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const provider = fakeProvider('freeipapi', async () => {
      await gate;
      return GEO_FREEIPAPI;
    });
    const service = makeService({ providers: [provider] });
    const both = Promise.all([service.lookup('1.1.1.1'), service.lookup('1.1.1.1')]);
    release();
    const [a, b] = await both;
    expect(provider.calls).toHaveLength(1);
    expect(a.network).toEqual(b.network);
  });

  it('does not cache failures', async () => {
    let fail = true;
    const provider = fakeProvider('freeipapi', async () => {
      if (fail) throw new Error('down');
      return GEO_FREEIPAPI;
    });
    const service = makeService({ providers: [provider] });
    await codeOf(service.lookup('1.1.1.1'));
    fail = false;
    await expect(service.lookup('1.1.1.1')).resolves.toMatchObject({ scope: 'public' });
  });

  it('stops calling providers when the global upstream budget is spent', async () => {
    const provider = fakeProvider('freeipapi', GEO_FREEIPAPI);
    const upstreamLimiter = new RateLimiter({ capacity: 1, refillPerSecond: 0.1 });
    const service = makeService({ providers: [provider], upstreamLimiter });
    await service.lookup('1.1.1.1');
    const err = await codeOf(service.lookup('8.8.8.8'));
    expect(err.code).toBe('upstream_rate_limited');
    expect(err.retryAfterSec).toBeGreaterThan(0);
    // cached and local answers do not need budget
    await expect(service.lookup('1.1.1.1')).resolves.toMatchObject({ source: { cached: true } });
    await expect(service.lookup('10.0.0.1')).resolves.toMatchObject({ source: { provider: 'local' } });
    expect(provider.calls).toEqual(['1.1.1.1']);
  });
});
