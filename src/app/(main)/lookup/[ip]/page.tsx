import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResultView } from '@/components/result-view';
import { SearchBar } from '@/components/SearchBar';
import { StatePanel } from '@/components/state-panel';
import { formatAsn, formatPlaceShort } from '@/lib/ip/format';
import { parseIp, unwrapIpv4Mapped } from '@/lib/ip/parse';
import type { LookupResult } from '@/lib/ip/types';
import { lookupForPage } from '@/lib/server/page-lookup';

type Props = { params: Promise<{ ip: string }> };

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function describe(r: LookupResult): string {
  if (r.scope !== 'public') {
    return r.range ? `${r.ip} is in ${r.range.cidr}: ${r.range.name} (${r.range.rfc}).` : `${r.ip} is not a public address.`;
  }
  const parts = [formatPlaceShort(r.location), r.network?.organization, formatAsn(r.network), r.hostname].filter(Boolean);
  return parts.length > 0 ? `${r.ip}: ${parts.join(' · ')}.` : `Lookup for ${r.ip}.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = parseIp(decode((await params).ip));
  if (!parsed) return { title: 'Not a valid IP address', robots: { index: false } };

  const ip = (unwrapIpv4Mapped(parsed) ?? parsed).canonical;
  const lookup = await lookupForPage(ip);
  const canonical = `/lookup/${ip}`;
  if (!lookup.ok) return { title: ip, robots: { index: false }, alternates: { canonical } };

  const place = formatPlaceShort(lookup.result.location);
  const title = place ? `${ip} · ${place}` : ip;
  const description = describe(lookup.result);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { card: 'summary', title, description },
  };
}

export default async function LookupPage({ params }: Props) {
  const input = decode((await params).ip);
  const parsed = parseIp(input);

  if (!parsed) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="sr-only">IP lookup</h1>
        <StatePanel code="invalid_ip" message="This link does not contain a valid IPv4 or IPv6 address." input={input} />
        <div className="max-w-2xl">
          <SearchBar label="Look up an address" />
        </div>
      </div>
    );
  }

  // middleware.ts already 308s non-canonical spellings; this is the fallback.
  const canonical = (unwrapIpv4Mapped(parsed) ?? parsed).canonical;
  if (input !== canonical) redirect(`/lookup/${canonical}`);

  const lookup = await lookupForPage(canonical);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Lookup: {canonical}</h1>
      {lookup.ok ? (
        <ResultView result={lookup.result} kind="lookup" />
      ) : (
        <StatePanel
          code={lookup.error.code}
          message={lookup.error.message}
          retryAfter={lookup.error.retryAfter}
          input={canonical}
        />
      )}
      <div className="max-w-2xl">
        <SearchBar label="Look up another address" showExamples={false} />
      </div>
    </div>
  );
}
