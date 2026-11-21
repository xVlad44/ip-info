import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Mark } from '@/components/site-chrome';
import { SearchBar } from '@/components/SearchBar';
import { StatePanel } from '@/components/state-panel';
import { parseIp } from '@/lib/ip/parse';

export const metadata: Metadata = {
  title: 'IP lookup',
  description: 'Location, network owner (ASN) and reverse DNS for any IPv4 or IPv6 address.',
};

type Props = { searchParams: Promise<{ ip?: string | string[] }> };

/** Old links (/tools/ip-lookup?ip=1.1.1.1) and the no-JS form both land here. */
export default async function IpLookupPage({ searchParams }: Props) {
  const raw = (await searchParams).ip;
  const ip = Array.isArray(raw) ? raw[0] : raw;
  const query = ip?.trim() ?? '';

  if (query.toLowerCase() === 'me') redirect('/tools/my-ip');
  const parsed = query ? parseIp(query) : null;
  if (parsed) redirect(`/lookup/${parsed.canonical}`);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-[68ch] flex-col gap-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">IP lookup</h1>
        <p className="text-muted-foreground">
          Location, network owner and reverse DNS for any public IPv4 or IPv6 address. Private and reserved ranges are
          recognised on the server and answered without asking a provider.
        </p>
      </header>
      <SearchBar defaultValue={query} />
      {query ? (
        <StatePanel code="invalid_ip" message="The address could not be parsed." input={query} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong p-6 sm:flex-row sm:items-center sm:p-8">
          <Mark className="size-8 shrink-0 text-gold-ink" />
          <div>
            <p className="font-medium">No address yet</p>
            <p className="text-[15px] text-muted-foreground">
              Results show up on their own page with a link you can share, like{' '}
              <span className="font-mono text-foreground">/lookup/1.1.1.1</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
