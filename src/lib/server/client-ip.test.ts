import { describe, expect, it } from 'vitest';
import { PEER_HEADER, parseTrustMode, resolveClientIp } from './client-ip';

const h = (init: Record<string, string>) => new Headers(init);

describe('resolveClientIp: loopback trust (production default)', () => {
  it('trusts CF-Connecting-IP when the peer is the local proxy', () => {
    const r = resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'cf-connecting-ip': '203.0.113.7' }));
    expect(r).toEqual({ ip: '203.0.113.7', via: 'cf-connecting-ip' });
  });

  it('treats ::1 and IPv4-mapped loopback as local too', () => {
    expect(resolveClientIp(h({ [PEER_HEADER]: '::1', 'cf-connecting-ip': '1.1.1.1' }))?.ip).toBe('1.1.1.1');
    expect(resolveClientIp(h({ [PEER_HEADER]: '::ffff:127.0.0.1', 'cf-connecting-ip': '1.1.1.1' }))?.ip).toBe('1.1.1.1');
  });

  it('ignores forwarded headers from a non-loopback peer (direct LAN connection)', () => {
    const r = resolveClientIp(
      h({ [PEER_HEADER]: '192.168.0.50', 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }),
    );
    expect(r).toEqual({ ip: '192.168.0.50', via: 'peer' });
  });

  it('reads X-Forwarded-For right to left, skipping our own loopback hops', () => {
    const r = resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'x-forwarded-for': '6.6.6.6, 198.51.100.4, 127.0.0.1' }));
    expect(r).toEqual({ ip: '198.51.100.4', via: 'x-forwarded-for' });
  });

  it('stops at an unparseable hop instead of trusting what lies left of it', () => {
    const r = resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'x-forwarded-for': '6.6.6.6, garbage, 127.0.0.1' }));
    expect(r).toEqual({ ip: '127.0.0.1', via: 'peer' });
  });

  it('falls back to X-Real-IP', () => {
    expect(resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'x-real-ip': '198.51.100.9' }))).toEqual({ ip: '198.51.100.9', via: 'x-real-ip' });
  });

  it('ignores a malformed CF-Connecting-IP', () => {
    expect(resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'cf-connecting-ip': 'not-an-ip' }))).toEqual({ ip: '127.0.0.1', via: 'peer' });
  });

  it('reports a mapped peer as IPv4', () => {
    expect(resolveClientIp(h({ [PEER_HEADER]: '::ffff:192.168.0.50' }))).toEqual({ ip: '192.168.0.50', via: 'peer' });
  });

  it('returns null when no peer was stamped and nothing is trusted', () => {
    expect(resolveClientIp(h({ 'cf-connecting-ip': '203.0.113.7' }))).toBeNull();
  });
});

describe('resolveClientIp: other modes', () => {
  it('never: only the peer counts', () => {
    expect(resolveClientIp(h({ [PEER_HEADER]: '127.0.0.1', 'cf-connecting-ip': '203.0.113.7' }), 'never')).toEqual({
      ip: '127.0.0.1',
      via: 'peer',
    });
  });

  it('always: headers count without a stamped peer', () => {
    expect(resolveClientIp(h({ 'cf-connecting-ip': '203.0.113.7' }), 'always')?.ip).toBe('203.0.113.7');
  });

  it('parseTrustMode defaults to loopback', () => {
    expect(parseTrustMode(undefined)).toBe('loopback');
    expect(parseTrustMode('yes')).toBe('loopback');
    expect(parseTrustMode('always')).toBe('always');
    expect(parseTrustMode('never')).toBe('never');
  });
});
