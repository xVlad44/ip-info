import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4 px-4 pb-16 pt-12 sm:px-6">
        <p className="eyebrow">404</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Nothing at this address</h1>
        <p className="max-w-[60ch] text-muted-foreground">
          The page does not exist. To look up an IP, use a link like{' '}
          <span className="font-mono text-foreground">/lookup/1.1.1.1</span>.
        </p>
        <p className="flex flex-wrap gap-4">
          <Link href="/" className="text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
            Show my IP
          </Link>
          <Link href="/tools/ip-lookup" className="text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
            Look up an address
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
