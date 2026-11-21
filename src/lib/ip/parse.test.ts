import { isIP } from 'node:net';
import { describe, expect, it } from 'vitest';
import { formatIpv6, parseIp, unwrapIpv4Mapped } from './parse';

describe('parseIp: IPv4', () => {
  it.each([
    ['1.1.1.1', '1.1.1.1'],
    ['0.0.0.0', '0.0.0.0'],
    ['255.255.255.255', '255.255.255.255'],
    ['  8.8.8.8 ', '8.8.8.8'],
  ])('accepts %j', (input, canonical) => {
    expect(parseIp(input)).toMatchObject({ version: 4, canonical });
  });

  it.each([
    '256.1.1.1',
    '999.1.1.1',
    '1.1.1',
    '1.1.1.1.1',
    '01.1.1.1', // leading zero: octal in inet_aton
    '0x7f.0.0.1',
    '127.1',
    '1.1.1.',
    '1..1.1',
    '-1.1.1.1',
    '1.1.1.1/24',
    '1.1.1.1:80',
    'example.com',
    '',
    '   ',
  ])('rejects %j', (input) => {
    expect(parseIp(input)).toBeNull();
  });
});

describe('parseIp: IPv6', () => {
  it.each([
    ['2606:4700:4700::1111', '2606:4700:4700::1111'],
    ['2606:4700:4700:0:0:0:0:1111', '2606:4700:4700::1111'],
    ['2001:DB8::1', '2001:db8::1'],
    ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
    ['::', '::'],
    ['::1', '::1'],
    ['1::', '1::'],
    ['fe80::1', 'fe80::1'],
    ['[2001:db8::1]', '2001:db8::1'],
    // RFC 5952 4.2.2: a single zero group is not shortened...
    ['2001:db8:0:1:1:1:1:1', '2001:db8:0:1:1:1:1:1'],
    // ...4.2.3: the longest run wins, the first on a tie.
    ['2001:0:0:1:0:0:0:1', '2001:0:0:1::1'],
    ['2001:db8:0:0:1:0:0:1', '2001:db8::1:0:0:1'],
    // Embedded IPv4 and RFC 5952 section 5 mixed notation for mapped addresses.
    ['::ffff:192.0.2.1', '::ffff:192.0.2.1'],
    ['::ffff:c000:201', '::ffff:192.0.2.1'],
    ['::1.2.3.4', '::102:304'],
    ['64:ff9b::192.0.2.33', '64:ff9b::c000:221'],
    ['1:2:3:4:5:6:1.2.3.4', '1:2:3:4:5:6:102:304'],
    ['1:2:3:4:5:6:7::', '1:2:3:4:5:6:7:0'],
  ])('accepts %j as %j', (input, canonical) => {
    expect(parseIp(input)).toMatchObject({ version: 6, canonical });
  });

  it.each([
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7',
    '1::2::3',
    ':::',
    ':1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:',
    '12345::1',
    'g::1',
    'fe80::1%eth0', // zone ids are interface-local
    '::ffff:256.1.1.1',
    '::ffff:1.1.1',
    '1:2:3:4:5:6:7:1.2.3.4', // IPv4 tail needs 6 groups before it
    '1:2:3:4:5:6:7:8::',
    '2001:db8::1/64',
  ])('rejects %j', (input) => {
    expect(parseIp(input)).toBeNull();
  });
});

describe('parseIp agrees with node:net on validity', () => {
  // node accepts zone ids; strip those from the comparison set on purpose.
  const corpus = [
    '1.2.3.4', '1.2.3', '1.2.3.4.5', '256.0.0.0', '0.0.0.0', '::', '::1', '1::', '::ffff:1.2.3.4',
    '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:9', '1::2::3', 'abcd::', 'abcde::', '::1.2.3.4', '1:2:3:4:5:6:1.2.3.4',
    '1:2:3:4:5:6:7:1.2.3.4', 'fe80::', 'ff02::1', '2001:db8:85a3::8a2e:370:7334', 'hello', '', '1.2.3.04',
  ];
  it.each(corpus)('%j', (input) => {
    const ours = parseIp(input)?.version ?? 0;
    expect(ours).toBe(isIP(input));
  });
});

describe('unwrapIpv4Mapped', () => {
  it('returns the IPv4 part of ::ffff:a.b.c.d', () => {
    expect(unwrapIpv4Mapped(parseIp('::ffff:127.0.0.1')!)?.canonical).toBe('127.0.0.1');
  });
  it('ignores other IPv6 and IPv4 addresses', () => {
    expect(unwrapIpv4Mapped(parseIp('::1')!)).toBeNull();
    expect(unwrapIpv4Mapped(parseIp('1.1.1.1')!)).toBeNull();
    expect(unwrapIpv4Mapped(parseIp('64:ff9b::1.1.1.1')!)).toBeNull();
  });
});

describe('formatIpv6', () => {
  it('prints all-zero as ::', () => {
    expect(formatIpv6(new Uint8Array(16))).toBe('::');
  });
});
