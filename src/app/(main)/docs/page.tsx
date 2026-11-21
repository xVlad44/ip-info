import type { Metadata } from 'next';
import { CodeBlock } from '@/components/code-block';
import fixture from '@/lib/ip/__fixtures__/freeipapi-1.1.1.1.json';
import { apiErrorSchema, lookupResultSchema } from '@/lib/ip/schema';
import type { LookupResult } from '@/lib/ip/types';
import { LIMITS } from '@/lib/server/instance';
import { normalizeFreeIpApi } from '@/lib/server/providers/freeipapi';
import { SITE_URL, SOURCE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'API',
  description: 'A keyless JSON API for IP lookups: endpoints, response schema, error codes and rate limits.',
};

// A real response: the FreeIPAPI answer for 1.1.1.1 recorded on 2026-11-20,
// run through the same normaliser the server uses.
const geo = normalizeFreeIpApi(fixture);
const sample: LookupResult = {
  ip: '1.1.1.1',
  version: 4,
  scope: 'public',
  range: null,
  hostname: 'one.one.one.one',
  location: geo.location,
  network: geo.network,
  source: { provider: 'freeipapi', cached: false, retrievedAt: '2026-11-20T23:53:53.148Z' },
};

const ERRORS = [
  { status: 400, code: 'invalid_ip', when: 'Missing ?ip=, or not a strict IPv4/IPv6 literal.' },
  { status: 429, code: 'rate_limited', when: 'You exceeded your per-client limit. See Retry-After.' },
  { status: 429, code: 'upstream_rate_limited', when: 'The providers (or this server’s budget for them) are exhausted. See Retry-After.' },
  { status: 502, code: 'upstream_unavailable', when: 'Every provider failed or timed out.' },
  { status: 500, code: 'client_ip_unknown', when: '/api/me could not determine your address.' },
];

const perMinute = LIMITS.client.refillPerSecond * 60;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path, children }: { method: string; path: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[15px]">
        <span className="mr-2 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium text-gold-ink">{method}</span>
        {path}
      </p>
      {children}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="flex max-w-[860px] flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">Reference</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">API</h1>
        <p className="max-w-[66ch] text-muted-foreground">
          HTTPS and JSON, no key. Every page on this site is built on the same endpoints. CORS is not enabled, so call
          it from a server, a script or a terminal.
        </p>
      </header>

      <Section id="endpoints" title="Endpoints">
        <Endpoint method="GET" path="/api/lookup?ip={address}">
          <p className="text-[15px] text-muted-foreground">
            Location, network and reverse DNS for any IPv4 or IPv6 address. Private, reserved and documentation ranges
            are answered locally with <code className="font-mono text-foreground">source.provider: &quot;local&quot;</code>.
          </p>
          <CodeBlock label="command" code={`curl "${SITE_URL}/api/lookup?ip=1.1.1.1"`} />
        </Endpoint>
        <Endpoint method="GET" path="/api/me">
          <p className="text-[15px] text-muted-foreground">
            The same result for the address you are calling from. Add{' '}
            <code className="font-mono text-foreground">?format=text</code> for just the address.
          </p>
          <CodeBlock label="command" code={`curl "${SITE_URL}/api/me?format=text"`} />
        </Endpoint>
        <Endpoint method="GET" path="/lookup/{address}">
          <p className="text-[15px] text-muted-foreground">The human-readable page for an address, server-rendered and safe to share.</p>
        </Endpoint>
      </Section>

      <Section id="response" title="Response">
        <p className="text-[15px] text-muted-foreground">
          Every provider is normalised into this one shape. Fields a provider does not supply are{' '}
          <code className="font-mono text-foreground">null</code>, never guessed. This sample is a real FreeIPAPI answer
          for 1.1.1.1, recorded on 2026-11-20 and run through the server’s normaliser.
        </p>
        <CodeBlock label="sample response" code={JSON.stringify(sample, null, 2)} />
      </Section>

      <Section id="errors" title="Errors">
        <p className="text-[15px] text-muted-foreground">
          Errors share one body: <code className="font-mono text-foreground">{'{ "error": { "code", "message", "retryAfter"? } }'}</code>.
          Branch on <code className="font-mono text-foreground">code</code>, not on the message.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-left text-[14px]">
            <thead className="bg-surface-2">
              <tr>
                <th scope="col" className="eyebrow px-4 py-2.5 font-normal">Status</th>
                <th scope="col" className="eyebrow px-4 py-2.5 font-normal">Code</th>
                <th scope="col" className="eyebrow px-4 py-2.5 font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.code} className="border-t border-border bg-card align-top">
                  <td className="px-4 py-2.5 font-mono tabular">{e.status}</td>
                  <td className="px-4 py-2.5 font-mono">{e.code}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="limits" title="Limits and caching">
        <ul className="flex max-w-[66ch] list-disc flex-col gap-2 pl-5 text-[15px] marker:text-muted-foreground">
          <li>
            {LIMITS.client.capacity} requests per client in a burst, refilling at {perMinute} per minute. Responses carry{' '}
            <code className="font-mono">RateLimit-Limit</code>, <code className="font-mono">RateLimit-Remaining</code> and{' '}
            <code className="font-mono">RateLimit-Reset</code>; a 429 adds <code className="font-mono">Retry-After</code>.
          </li>
          <li>
            Answers are cached on the server for {LIMITS.cache.ttlMs / 3_600_000} hours;{' '}
            <code className="font-mono">source.cached</code> says whether you got a cached one.
          </li>
          <li>Upstream calls time out after 2.5 s each; the second provider is tried when the first fails.</li>
        </ul>
      </Section>

      <Section id="schema" title="JSON Schema">
        <p className="text-[15px] text-muted-foreground">Draft 2020-12. The test suite validates real normalised responses against it.</p>
        <CodeBlock label="LookupResult schema" code={JSON.stringify(lookupResultSchema, null, 2)} />
        <CodeBlock label="ApiError schema" code={JSON.stringify(apiErrorSchema, null, 2)} />
      </Section>

      <Section id="trust" title="How /api/me finds your address">
        <p className="max-w-[66ch] text-[15px] text-muted-foreground">
          From the request, not from a third party. Behind Cloudflare the address arrives in{' '}
          <code className="font-mono text-foreground">CF-Connecting-IP</code>; the app trusts that header only when the
          connection comes from a proxy on the same machine, so it cannot be spoofed by connecting directly. Details in
          the{' '}
          <a href={`${SOURCE_URL}#trust-model-for-client-ip-headers`} className="text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
            README
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
