/**
 * Reverse DNS (PTR) with a hard timeout. Never throws: a missing or slow PTR
 * record is normal and must not fail the lookup.
 *
 * Only ever called for public addresses (see lookup-service.ts). Resolving
 * private space would query the server's own LAN resolver and could expose
 * hostnames from the network the Pi sits on.
 */
import { Resolver } from 'node:dns/promises';

/** PTR data is untrusted input that ends up on the page; accept plain hostnames only. */
export function cleanHostname(name: string): string | null {
  const host = name.replace(/\.$/, '').toLowerCase();
  if (host.length === 0 || host.length > 253) return null;
  if (!/^[a-z0-9_]([a-z0-9_-]{0,62})(\.[a-z0-9_]([a-z0-9_-]{0,62}))*$/.test(host)) return null;
  return host;
}

export interface ReverseDnsOptions {
  timeoutMs: number;
  /** Injectable for tests. */
  createResolver?: () => Pick<Resolver, 'reverse' | 'cancel'>;
}

export function createReverseDns({ timeoutMs, createResolver }: ReverseDnsOptions) {
  const make = createResolver ?? (() => new Resolver({ timeout: timeoutMs, tries: 1 }));
  return async function reverseDns(ip: string): Promise<string | null> {
    const resolver = make();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        resolver.cancel();
        resolve(null);
      }, timeoutMs);
    });
    try {
      const names = await Promise.race([resolver.reverse(ip), timeout]);
      if (!names) return null;
      for (const n of names) {
        const host = cleanHostname(n);
        if (host) return host;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
