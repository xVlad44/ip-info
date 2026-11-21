import { Braces } from 'lucide-react';
import { SCOPE_LABEL } from '@/lib/ip/ranges';
import { formatAsn, formatCoordinates, formatPlace, formatPlaceShort, formatUtc } from '@/lib/ip/format';
import type { LookupResult } from '@/lib/ip/types';
import { CopyButton } from './copy-button';
import { MapPanel } from './map-panel';

const PROVIDER_LABEL: Record<LookupResult['source']['provider'], string> = {
  freeipapi: 'FreeIPAPI',
  ipapi: 'ipapi.co',
  local: 'answered locally',
};

function Fact({ label, children, copy }: { label: string; children: React.ReactNode; copy?: { value: string; label: string } }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 sm:grid-cols-[9rem_1fr_auto]">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
      <div className="-my-1 flex w-10 justify-end">{copy && <CopyButton value={copy.value} label={copy.label} />}</div>
    </div>
  );
}

const missing = <span className="text-muted-foreground">Not available</span>;

export function ResultView({ result, kind }: { result: LookupResult; kind: 'self' | 'lookup' }) {
  const { location, network, range } = result;
  const isPublic = result.scope === 'public';
  const hasCoords = location?.latitude != null && location?.longitude != null;
  const placeShort = formatPlaceShort(location);
  const asn = formatAsn(network);
  const eyebrow = kind === 'self' ? 'Your address' : 'Lookup';

  return (
    <section aria-labelledby="result-ip" className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-1 border-b border-border p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="eyebrow">
            {eyebrow} · IPv{result.version}
          </p>
          <span
            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[12px] leading-none tracking-wide ${
              isPublic ? 'border-line-strong text-foreground' : 'border-gold-ink/40 text-gold-ink'
            }`}
          >
            {SCOPE_LABEL[result.scope]}
          </span>
        </div>
        <div className="flex items-start gap-1">
          <h2
            id="result-ip"
            className="min-w-0 font-mono text-[clamp(1.75rem,6.5vw,3.25rem)] leading-[1.1] font-medium tracking-tight break-all tabular"
          >
            {result.ip}
          </h2>
          <CopyButton value={result.ip} label="IP address" className="mt-1 sm:mt-2.5" />
        </div>
        {isPublic ? (
          <p className="mt-1 text-lg sm:text-xl">
            {placeShort ?? <span className="text-muted-foreground">Location unknown</span>}
            {(network?.organization || asn) && (
              <span className="text-muted-foreground">
                {' · '}
                {network?.organization ?? asn}
              </span>
            )}
          </p>
        ) : (
          range && (
            <p className="mt-1 text-lg sm:text-xl">
              {range.name}
              <span className="text-muted-foreground"> · {range.cidr}</span>
            </p>
          )
        )}
      </div>

      {isPublic ? (
        <div className={`grid gap-6 p-5 sm:p-7 ${hasCoords ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]' : ''}`}>
          <dl className="text-[15px]">
            <Fact label="Network" copy={asn ? { value: asn, label: 'ASN' } : undefined}>
              {asn || network?.organization ? (
                <>
                  {asn && <span className="font-mono">{asn}</span>}
                  {asn && network?.organization && <span className="text-muted-foreground"> · </span>}
                  {network?.organization}
                </>
              ) : (
                missing
              )}
            </Fact>
            <Fact label="Hostname" copy={result.hostname ? { value: result.hostname, label: 'hostname' } : undefined}>
              {result.hostname ? <span className="font-mono">{result.hostname}</span> : <span className="text-muted-foreground">No reverse DNS record</span>}
            </Fact>
            <Fact label="Location">
              {formatPlace(location) ?? missing}
              {location?.countryCode && (
                <span className="ml-2 rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">{location.countryCode}</span>
              )}
            </Fact>
            <Fact
              label="Coordinates"
              copy={hasCoords ? { value: `${location!.latitude}, ${location!.longitude}`, label: 'coordinates' } : undefined}
            >
              {hasCoords ? <span className="font-mono tabular">{formatCoordinates(location!.latitude!, location!.longitude!)}</span> : missing}
            </Fact>
            <Fact label="Timezone">{location?.timezone ? <span className="font-mono">{location.timezone}</span> : missing}</Fact>
            <Fact label="Postal code">{location?.postalCode ? <span className="font-mono">{location.postalCode}</span> : missing}</Fact>
          </dl>
          {hasCoords && <MapPanel lat={location!.latitude!} lon={location!.longitude!} place={placeShort} />}
        </div>
      ) : (
        <div className="p-5 sm:p-7">
          <p className="max-w-[62ch] text-[15px]">{range?.note}</p>
          <p className="mt-3 max-w-[62ch] text-[15px] text-muted-foreground">
            {kind === 'self'
              ? 'You are reaching this server without going through the public internet, so there is no public address, owner or location to show.'
              : 'Addresses in this range have no public owner or location, so this was answered on the server without asking a geolocation provider.'}
          </p>
          {range && (
            <p className="mt-4 font-mono text-[13px] text-muted-foreground">
              {range.cidr} · {range.rfc}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="font-mono text-[12.5px] text-muted-foreground">
          Source: {PROVIDER_LABEL[result.source.provider]}
          {result.source.cached && ' (cached)'} · <time dateTime={result.source.retrievedAt}>{formatUtc(result.source.retrievedAt)}</time>
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={`/lookup/${result.ip}`} label="Copy link" showText />
          <a
            href={`/api/lookup?ip=${encodeURIComponent(result.ip)}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Braces className="size-4" aria-hidden="true" />
            JSON
          </a>
        </div>
      </div>
    </section>
  );
}
