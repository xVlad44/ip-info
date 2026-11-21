/**
 * Strict IPv4 / IPv6 parsing with no dependencies, so the same code validates
 * input in the browser (instant feedback) and on the server (the API boundary).
 *
 * Deliberately stricter than inet_aton: no octal, hex, or shortened IPv4
 * forms ("010.1.1.1", "0x7f.1", "127.1"), and no IPv6 zone ids ("fe80::1%eth0").
 * Those forms are legal in some parsers and mean different things in others,
 * which is exactly what an API boundary should refuse.
 */

export type IpVersion = 4 | 6;

export interface ParsedIp {
  version: IpVersion;
  /** 4 bytes for IPv4, 16 for IPv6. */
  bytes: Uint8Array;
  /** Canonical text form: dotted quad, or RFC 5952 for IPv6. */
  canonical: string;
}

const MAX_INPUT_LENGTH = 45; // longest IPv6 text form with an embedded IPv4 tail

function parseIpv4Bytes(input: string): Uint8Array | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const part = parts[i];
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part[0] === '0') return null; // leading zero: octal in some parsers
    const value = Number(part);
    if (value > 255) return null;
    out[i] = value;
  }
  return out;
}

function parseIpv6Bytes(input: string): Uint8Array | null {
  if (input.includes('%')) return null; // zone ids are interface-local, never valid here

  let head = input;
  let ipv4Tail: Uint8Array | null = null;

  // An embedded IPv4 tail (e.g. ::ffff:192.0.2.1) takes the last 32 bits.
  const lastColon = input.lastIndexOf(':');
  if (lastColon !== -1 && input.indexOf('.', lastColon) !== -1) {
    ipv4Tail = parseIpv4Bytes(input.slice(lastColon + 1));
    if (!ipv4Tail) return null;
    // "::1.2.3.4" leaves "::", "::ffff:1.2.3.4" leaves "::ffff:". Append one placeholder
    // group so both shapes split cleanly; it is dropped again below.
    head = input.slice(0, lastColon + 1) + '0';
  }

  // Eight 16-bit groups, or six when an IPv4 tail supplies the last 32 bits.
  const groupsNeeded = ipv4Tail ? 6 : 8;
  const doubleColon = head.indexOf('::');
  if (doubleColon !== -1 && head.indexOf('::', doubleColon + 1) !== -1) return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const groups = s.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  let groups: number[];
  if (doubleColon !== -1) {
    const left = parseGroups(head.slice(0, doubleColon));
    const right = parseGroups(head.slice(doubleColon + 2));
    if (!left || !right) return null;
    // The placeholder group we appended for an IPv4 tail sits at the end of `right`.
    const rightReal = ipv4Tail ? right.slice(0, -1) : right;
    const missing = groupsNeeded - left.length - rightReal.length;
    if (missing < 1) return null; // "::" must stand for at least one group
    groups = [...left, ...new Array<number>(missing).fill(0), ...rightReal];
  } else {
    const all = parseGroups(head);
    if (!all) return null;
    groups = ipv4Tail ? all.slice(0, -1) : all;
    if (groups.length !== groupsNeeded) return null;
  }

  const out = new Uint8Array(16);
  groups.forEach((g, i) => {
    out[i * 2] = g >> 8;
    out[i * 2 + 1] = g & 0xff;
  });
  if (ipv4Tail) out.set(ipv4Tail, 12);
  return out;
}

export function formatIpv4(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 4)).join('.');
}

/**
 * RFC 5952: lowercase, no leading zeros, the longest run (>= 2) of zero groups
 * as "::", and IPv4-mapped addresses in mixed notation (::ffff:192.0.2.1, §5).
 */
export function formatIpv6(bytes: Uint8Array): string {
  if (bytes.subarray(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return `::ffff:${formatIpv4(bytes.subarray(12, 16))}`;
  }
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push((bytes[i] << 8) | bytes[i + 1]);

  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }

  const hex = (gs: number[]) => gs.map((g) => g.toString(16)).join(':');
  if (bestLen < 2) return hex(groups);
  return `${hex(groups.slice(0, bestStart))}::${hex(groups.slice(bestStart + bestLen))}`;
}

/** Parse an IP address, or return null if it is not a strict IPv4/IPv6 literal. */
export function parseIp(raw: string): ParsedIp | null {
  if (typeof raw !== 'string') return null;
  let input = raw.trim();
  if (input.length === 0 || input.length > MAX_INPUT_LENGTH + 2) return null;
  // Accept the bracketed URL form "[2001:db8::1]" people paste from addresses.
  if (input.startsWith('[') && input.endsWith(']')) input = input.slice(1, -1);
  if (input.length > MAX_INPUT_LENGTH) return null;

  if (!input.includes(':')) {
    const bytes = parseIpv4Bytes(input);
    return bytes ? { version: 4, bytes, canonical: formatIpv4(bytes) } : null;
  }

  const bytes = parseIpv6Bytes(input);
  return bytes ? { version: 6, bytes, canonical: formatIpv6(bytes) } : null;
}

/** The IPv4 address inside an IPv4-mapped IPv6 address (::ffff:a.b.c.d), if any. */
export function unwrapIpv4Mapped(ip: ParsedIp): ParsedIp | null {
  if (ip.version !== 6) return null;
  const b = ip.bytes;
  for (let i = 0; i < 10; i++) if (b[i] !== 0) return null;
  if (b[10] !== 0xff || b[11] !== 0xff) return null;
  const v4 = b.slice(12, 16);
  return { version: 4, bytes: v4, canonical: formatIpv4(v4) };
}

export function isValidIp(raw: string): boolean {
  return parseIp(raw) !== null;
}
