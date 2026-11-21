import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResultSkeleton } from '@/components/result-skeleton';
import { SelfReadout } from '@/components/self-readout';
import { clientIdentity } from '@/lib/server/page-lookup';
import type { ClientIpSource } from '@/lib/server/client-ip';

export const metadata: Metadata = {
  title: 'My IP',
  description: 'Your public IP address with its location, network owner and reverse DNS.',
};

const HOW: Record<ClientIpSource, string> = {
  'cf-connecting-ip':
    'Read from the CF-Connecting-IP header, which Cloudflare’s edge sets. The app accepts it because the request reached it through the proxy on the same machine.',
  'x-forwarded-for':
    'Read from the right-most untrusted hop of X-Forwarded-For, added by the proxy in front of the app.',
  'x-real-ip': 'Read from the X-Real-IP header set by the proxy in front of the app.',
  peer: 'Read from the TCP connection itself: nothing sat between your client and the app, so no proxy header was trusted.',
};

async function HowWeKnow() {
  const id = await clientIdentity();
  if (!id) return null;
  return (
    <section aria-labelledby="how" className="max-w-[70ch]">
      <h2 id="how" className="eyebrow mb-2">
        How this was determined
      </h2>
      <p className="text-[15px] text-muted-foreground">
        {HOW[id.via]} No third-party service is asked for your address; providers are only asked where it is.
      </p>
    </section>
  );
}

export default function MyIpPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold sm:text-4xl">My IP</h1>
        <p className="text-muted-foreground">The address this server sees for you, and what is known about it.</p>
      </header>
      <Suspense fallback={<ResultSkeleton label="Finding your address…" />}>
        <SelfReadout />
      </Suspense>
      <Suspense fallback={null}>
        <HowWeKnow />
      </Suspense>
    </div>
  );
}
