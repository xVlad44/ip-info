import type { Metadata } from 'next';
import Link from 'next/link';
import { Hammer } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cloudflare checker',
  description: 'Planned: check whether a website sits behind Cloudflare.',
  robots: { index: false },
};

/**
 * Placeholder. The earlier client-side version fetched sites through a public
 * CORS proxy and never shipped enabled. Doing it properly means a server-side
 * check (DNS against Cloudflare's published ranges, plus cf-ray headers),
 * which is not built yet, so the page says so instead of offering a dead form.
 */
export default function CloudflareCheckerPage() {
  return (
    <div className="flex max-w-[68ch] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Planned</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Cloudflare checker</h1>
        <p className="text-muted-foreground">Check whether a website is served through Cloudflare’s network.</p>
      </header>
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong p-6">
        <Hammer className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden="true" />
        <div className="flex flex-col gap-2 text-[15px]">
          <p className="font-medium">Not available yet</p>
          <p className="text-muted-foreground">
            The check will run on the server: resolve the domain, compare its addresses with Cloudflare’s published IP
            ranges, and look for <span className="font-mono">cf-ray</span> response headers.
          </p>
          <p className="text-muted-foreground">
            Meanwhile, an{' '}
            <Link href="/tools/ip-lookup" className="text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
              IP lookup
            </Link>{' '}
            of a site’s address shows its network owner; Cloudflare’s is AS13335.
          </p>
        </div>
      </div>
    </div>
  );
}
