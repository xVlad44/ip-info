import { describe, expect, it, vi } from 'vitest';
import { cleanHostname, createReverseDns } from './rdns';

function resolver(reverse: () => Promise<string[]>) {
  return { reverse: vi.fn(reverse), cancel: vi.fn() };
}

describe('reverse DNS', () => {
  it('returns the first plain hostname, lower-cased, without the trailing dot', async () => {
    const r = resolver(async () => ['One.One.One.One.']);
    await expect(createReverseDns({ timeoutMs: 100, createResolver: () => r })('1.1.1.1')).resolves.toBe('one.one.one.one');
  });

  it('skips PTR answers that are not plain hostnames', async () => {
    const r = resolver(async () => ['<script>alert(1)</script>', 'host.example.net']);
    await expect(createReverseDns({ timeoutMs: 100, createResolver: () => r })('1.1.1.1')).resolves.toBe('host.example.net');
  });

  it('resolves null on NXDOMAIN or any resolver error', async () => {
    const r = resolver(async () => {
      throw Object.assign(new Error('queryPtr ENOTFOUND'), { code: 'ENOTFOUND' });
    });
    await expect(createReverseDns({ timeoutMs: 100, createResolver: () => r })('203.0.113.1')).resolves.toBeNull();
  });

  it('gives up after the timeout and cancels the query', async () => {
    vi.useFakeTimers();
    try {
      const r = resolver(() => new Promise<string[]>(() => {}));
      const pending = createReverseDns({ timeoutMs: 1500, createResolver: () => r })('1.1.1.1');
      await vi.advanceTimersByTimeAsync(1500);
      await expect(pending).resolves.toBeNull();
      expect(r.cancel).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanHostname rejects junk', () => {
    expect(cleanHostname('a..b')).toBeNull();
    expect(cleanHostname('-bad.example')).toBeNull();
    expect(cleanHostname('x'.repeat(254))).toBeNull();
    expect(cleanHostname('dns.google.')).toBe('dns.google');
  });
});
