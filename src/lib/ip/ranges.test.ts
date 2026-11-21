import { describe, expect, it } from 'vitest';
import { parseIp } from './parse';
import { classifyIp, type IpScope } from './ranges';

function scopeOf(ip: string): IpScope {
  const parsed = parseIp(ip);
  if (!parsed) throw new Error(`test input does not parse: ${ip}`);
  return classifyIp(parsed).scope;
}

describe('classifyIp', () => {
  it.each<[string, IpScope]>([
    // RFC 1918, with the edges of 172.16.0.0/12
    ['10.0.0.1', 'private'],
    ['10.255.255.255', 'private'],
    ['172.15.255.255', 'public'],
    ['172.16.0.0', 'private'],
    ['172.31.255.255', 'private'],
    ['172.32.0.0', 'public'],
    ['192.168.1.1', 'private'],
    ['192.169.0.1', 'public'],
    // CGNAT 100.64.0.0/10
    ['100.63.255.255', 'public'],
    ['100.64.0.0', 'shared'],
    ['100.127.255.255', 'shared'],
    ['100.128.0.0', 'public'],
    // loopback, link-local, "this network", unspecified
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['169.254.10.20', 'link-local'],
    ['0.0.0.0', 'unspecified'],
    ['0.1.2.3', 'reserved'],
    // documentation, benchmarking, multicast, reserved, broadcast
    ['192.0.2.1', 'documentation'],
    ['198.51.100.7', 'documentation'],
    ['203.0.113.200', 'documentation'],
    ['198.18.0.1', 'benchmarking'],
    ['198.19.255.255', 'benchmarking'],
    ['198.20.0.0', 'public'],
    ['224.0.0.251', 'multicast'],
    ['239.255.255.255', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.254', 'reserved'],
    ['255.255.255.255', 'broadcast'],
    // public IPv4
    ['1.1.1.1', 'public'],
    ['8.8.8.8', 'public'],
    // IPv6
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['fe80::1', 'link-local'],
    ['febf:ffff::1', 'link-local'],
    ['fc00::1', 'private'],
    ['fd12:3456:789a::1', 'private'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentation'],
    ['3fff::1', 'documentation'],
    ['2001:2::1', 'benchmarking'],
    ['100::1', 'reserved'],
    ['fec0::1', 'reserved'], // deprecated site-local, outside 2000::/3
    ['1::', 'reserved'],
    ['2606:4700:4700::1111', 'public'],
    ['2a00:1450:4001::200e', 'public'],
    // IPv4-mapped IPv6 is judged by its IPv4 part
    ['::ffff:10.0.0.1', 'private'],
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:1.1.1.1', 'public'],
  ])('%s is %s', (ip, scope) => {
    expect(scopeOf(ip)).toBe(scope);
  });

  it('names the range and its RFC', () => {
    expect(classifyIp(parseIp('100.64.1.1')!).range).toMatchObject({ cidr: '100.64.0.0/10', rfc: 'RFC 6598' });
    expect(classifyIp(parseIp('fd00::1')!).range).toMatchObject({ cidr: 'fc00::/7', rfc: 'RFC 4193' });
  });

  it('returns no range for public space', () => {
    expect(classifyIp(parseIp('1.1.1.1')!).range).toBeNull();
  });
});
