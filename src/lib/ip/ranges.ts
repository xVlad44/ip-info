/**
 * Local classification of special-purpose address space, from the IANA
 * IPv4/IPv6 Special-Purpose Address Registries. Anything matched here is
 * answered without a provider call: there is no public owner or location to
 * look up, and asking a third party about a private address leaks nothing
 * useful and burns quota.
 */
import { parseIp, unwrapIpv4Mapped, type ParsedIp } from './parse';

export type IpScope =
  | 'public'
  | 'private'
  | 'shared'
  | 'loopback'
  | 'link-local'
  | 'multicast'
  | 'documentation'
  | 'benchmarking'
  | 'unspecified'
  | 'broadcast'
  | 'reserved';

export interface SpecialRange {
  cidr: string;
  scope: Exclude<IpScope, 'public'>;
  name: string;
  rfc: string;
  /** One plain sentence on what an address in this range means. */
  note: string;
}

export interface Classification {
  scope: IpScope;
  /** The special-purpose range the address falls in, or null for public space. */
  range: SpecialRange | null;
}

const RANGES: SpecialRange[] = [
  // IPv4
  { cidr: '0.0.0.0/32', scope: 'unspecified', name: 'Unspecified address', rfc: 'RFC 1122', note: 'Means "no address"; a host uses it before it has one.' },
  { cidr: '0.0.0.0/8', scope: 'reserved', name: '"This network"', rfc: 'RFC 791', note: 'Only valid as a source address while a host is configuring itself.' },
  { cidr: '10.0.0.0/8', scope: 'private', name: 'Private-use network', rfc: 'RFC 1918', note: 'Used inside home and office networks; not routed on the public internet.' },
  { cidr: '100.64.0.0/10', scope: 'shared', name: 'Shared address space (carrier-grade NAT)', rfc: 'RFC 6598', note: 'Your ISP sits between this address and the internet; many customers share one public IP.' },
  { cidr: '127.0.0.0/8', scope: 'loopback', name: 'Loopback', rfc: 'RFC 1122', note: 'Always the machine itself; traffic never leaves the host.' },
  { cidr: '169.254.0.0/16', scope: 'link-local', name: 'Link-local', rfc: 'RFC 3927', note: 'Self-assigned when no DHCP server answered; valid on the local link only.' },
  { cidr: '172.16.0.0/12', scope: 'private', name: 'Private-use network', rfc: 'RFC 1918', note: 'Used inside home and office networks; not routed on the public internet.' },
  { cidr: '192.0.0.0/24', scope: 'reserved', name: 'IETF protocol assignments', rfc: 'RFC 6890', note: 'Set aside for protocol use, not for ordinary hosts.' },
  { cidr: '192.0.2.0/24', scope: 'documentation', name: 'Documentation (TEST-NET-1)', rfc: 'RFC 5737', note: 'Reserved for examples in documentation; never assigned to a real host.' },
  { cidr: '192.88.99.0/24', scope: 'reserved', name: '6to4 relay anycast (deprecated)', rfc: 'RFC 7526', note: 'Formerly used for 6to4 relays; deprecated.' },
  { cidr: '192.168.0.0/16', scope: 'private', name: 'Private-use network', rfc: 'RFC 1918', note: 'Used inside home and office networks; not routed on the public internet.' },
  { cidr: '198.18.0.0/15', scope: 'benchmarking', name: 'Benchmarking', rfc: 'RFC 2544', note: 'Reserved for network device testing.' },
  { cidr: '198.51.100.0/24', scope: 'documentation', name: 'Documentation (TEST-NET-2)', rfc: 'RFC 5737', note: 'Reserved for examples in documentation; never assigned to a real host.' },
  { cidr: '203.0.113.0/24', scope: 'documentation', name: 'Documentation (TEST-NET-3)', rfc: 'RFC 5737', note: 'Reserved for examples in documentation; never assigned to a real host.' },
  { cidr: '224.0.0.0/4', scope: 'multicast', name: 'Multicast', rfc: 'RFC 5771', note: 'Addresses a group of receivers, not a single host.' },
  { cidr: '255.255.255.255/32', scope: 'broadcast', name: 'Limited broadcast', rfc: 'RFC 919', note: 'Reaches every host on the local network segment.' },
  { cidr: '240.0.0.0/4', scope: 'reserved', name: 'Reserved for future use', rfc: 'RFC 1112', note: 'Never allocated; most systems refuse to route it.' },
  // IPv6
  { cidr: '::/128', scope: 'unspecified', name: 'Unspecified address', rfc: 'RFC 4291', note: 'Means "no address"; a host uses it before it has one.' },
  { cidr: '::1/128', scope: 'loopback', name: 'Loopback', rfc: 'RFC 4291', note: 'Always the machine itself; traffic never leaves the host.' },
  { cidr: '100::/64', scope: 'reserved', name: 'Discard-only prefix', rfc: 'RFC 6666', note: 'Traffic sent here is dropped on purpose.' },
  { cidr: '2001:2::/48', scope: 'benchmarking', name: 'Benchmarking', rfc: 'RFC 5180', note: 'Reserved for network device testing.' },
  { cidr: '2001:db8::/32', scope: 'documentation', name: 'Documentation', rfc: 'RFC 3849', note: 'Reserved for examples in documentation; never assigned to a real host.' },
  { cidr: '3fff::/20', scope: 'documentation', name: 'Documentation', rfc: 'RFC 9637', note: 'Reserved for examples in documentation; never assigned to a real host.' },
  { cidr: 'fc00::/7', scope: 'private', name: 'Unique local address (ULA)', rfc: 'RFC 4193', note: 'The IPv6 counterpart of private networks; not routed on the public internet.' },
  { cidr: 'fe80::/10', scope: 'link-local', name: 'Link-local', rfc: 'RFC 4291', note: 'Valid on the local link only; every IPv6 interface has one.' },
  { cidr: 'ff00::/8', scope: 'multicast', name: 'Multicast', rfc: 'RFC 4291', note: 'Addresses a group of receivers, not a single host.' },
];

/** Everything outside 2000::/3 that the table above does not name. */
const OUTSIDE_GLOBAL_UNICAST: SpecialRange = {
  cidr: '2000::/3',
  scope: 'reserved',
  name: 'Outside global unicast space',
  rfc: 'RFC 4291',
  note: 'Public IPv6 addresses all sit in 2000::/3; this one is unallocated or reserved.',
};

interface CompiledRange {
  range: SpecialRange;
  version: 4 | 6;
  prefix: Uint8Array;
  bits: number;
}

function compile(range: SpecialRange): CompiledRange {
  const [addr, len] = range.cidr.split('/');
  const parsed = parseIp(addr);
  if (!parsed) throw new Error(`bad CIDR in range table: ${range.cidr}`);
  return { range, version: parsed.version, prefix: parsed.bytes, bits: Number(len) };
}

// Longest prefix first, so 0.0.0.0/32 wins over 0.0.0.0/8.
const COMPILED = RANGES.map(compile).sort((a, b) => b.bits - a.bits);

export function inPrefix(bytes: Uint8Array, prefix: Uint8Array, bits: number): boolean {
  const full = bits >> 3;
  for (let i = 0; i < full; i++) if (bytes[i] !== prefix[i]) return false;
  const rest = bits & 7;
  if (rest === 0) return true;
  const mask = (0xff << (8 - rest)) & 0xff;
  return (bytes[full] & mask) === (prefix[full] & mask);
}

export function classifyIp(ip: ParsedIp): Classification {
  // ::ffff:a.b.c.d is an IPv4 address carried in IPv6; judge the IPv4 part.
  const mapped = unwrapIpv4Mapped(ip);
  if (mapped) return classifyIp(mapped);

  for (const c of COMPILED) {
    if (c.version === ip.version && inPrefix(ip.bytes, c.prefix, c.bits)) {
      return { scope: c.range.scope, range: c.range };
    }
  }
  if (ip.version === 6 && (ip.bytes[0] & 0xe0) !== 0x20) {
    return { scope: OUTSIDE_GLOBAL_UNICAST.scope, range: OUTSIDE_GLOBAL_UNICAST };
  }
  return { scope: 'public', range: null };
}

export function isLoopback(ip: ParsedIp): boolean {
  return classifyIp(ip).scope === 'loopback';
}

export const SCOPE_LABEL: Record<IpScope, string> = {
  public: 'Public',
  private: 'Private',
  shared: 'Carrier-grade NAT',
  loopback: 'Loopback',
  'link-local': 'Link-local',
  multicast: 'Multicast',
  documentation: 'Documentation',
  benchmarking: 'Benchmarking',
  unspecified: 'Unspecified',
  broadcast: 'Broadcast',
  reserved: 'Reserved',
};
