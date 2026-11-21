# ip.xvlad.dev

What is my IP, and where is this IP? A small Next.js app and keyless JSON API that answers both:
your public address as the server sees it, and location, network owner (ASN) and reverse DNS for
any IPv4 or IPv6 address. Private and reserved ranges are recognised locally and never sent to a
third party.

```sh
curl https://ip.xvlad.dev/api/me?format=text
curl "https://ip.xvlad.dev/api/lookup?ip=1.1.1.1"
```

## Architecture

```
 browser ──> pages (server-rendered)          curl ──> route handlers
             /  /tools/my-ip  /lookup/[ip]             /api/lookup  /api/me
                      │                                      │
                      └──────────────┬───────────────────────┘
                                     ▼
            client identity (trust model) ──> per-client rate limit
                                     ▼
            lookup service
              parse (strict IPv4/IPv6) ─> classify (IANA special-purpose ranges)
                 ├─ non-public ─> answered locally, no network
                 └─ public ─> LRU+TTL cache ─> in-flight dedupe ─> upstream budget
                                ─> providers in order: FreeIPAPI, then ipapi.co
                                   (+ reverse DNS in parallel)
                                ─> one normalised LookupResult
```

The pages and the API call the same service, so the UI is a client of the API's logic, not a
second implementation. Provider JSON never leaves its adapter; everything above it speaks
`LookupResult` (`src/lib/ip/types.ts`).

| Module | Job |
|---|---|
| `src/lib/ip/parse.ts` | Strict IPv4/IPv6 parser, RFC 5952 formatting. No dependencies, so the browser validates with the same code as the server. |
| `src/lib/ip/ranges.ts` | Special-purpose ranges (RFC 1918, CGNAT, loopback, link-local, multicast, documentation, benchmarking, ULA, ...), longest prefix wins. |
| `src/lib/server/lookup-service.ts` | The pipeline above. Providers, DNS, cache and clock are injected. |
| `src/lib/server/providers/` | `GeoProvider` interface, one adapter per provider, `fetchJson` with timeouts and typed errors. |
| `src/lib/server/cache.ts`, `rate-limit.ts` | LRU+TTL cache; token-bucket limiter with a bounded key map. |
| `src/lib/server/client-ip.ts`, `peer-stamp.ts`, `src/instrumentation.ts` | Who the client is (see the trust model below). |
| `src/lib/server/handlers.ts` | HTTP layer: status codes, error bodies, rate-limit headers. |
| `src/middleware.ts` | 308 redirects to the canonical URL of an address. |
| `src/app/` | Pages, route handlers, docs. |

## API

Full reference with the JSON Schema: [ip.xvlad.dev/docs](https://ip.xvlad.dev/docs).

| Endpoint | Returns |
|---|---|
| `GET /api/lookup?ip={address}` | `LookupResult` for any IPv4/IPv6 address |
| `GET /api/me` | `LookupResult` for the caller; `?format=text` returns just the address |
| `GET /lookup/{address}` | The shareable HTML page for an address |

Errors share one body, `{"error": {"code", "message", "retryAfter"?}}`:

| Status | Code | When |
|---|---|---|
| 400 | `invalid_ip` | missing `?ip=`, or not a strict IPv4/IPv6 literal |
| 429 | `rate_limited` | the client's own limit; `Retry-After` set |
| 429 | `upstream_rate_limited` | providers (or this server's budget for them) exhausted; `Retry-After` set |
| 502 | `upstream_unavailable` | every provider failed or timed out |
| 500 | `client_ip_unknown` | `/api/me` could not determine the caller |

The UI maps the same codes to its states (invalid input, rate limited with a countdown hint,
providers down with a retry button). Every API response carries `RateLimit-Limit`,
`RateLimit-Remaining` and `RateLimit-Reset`.

## Trust model for client IP headers

Production runs `next start` on a Raspberry Pi: Cloudflare, then a Cloudflare Tunnel, then nginx
on localhost, then the app. The app's TCP peer is therefore always `127.0.0.1`, and the visitor's
address only exists in headers: Cloudflare sets `CF-Connecting-IP`, and nginx can add
`X-Forwarded-For`.

Headers are only as trustworthy as whoever set them, and anyone who can open a TCP connection to
the app port can send any `CF-Connecting-IP` they like. So:

- Forwarded headers are believed only when the direct peer is loopback (`127.0.0.0/8`, `::1`,
  `::ffff:127.x`), meaning the request came through a proxy on the same machine.
- Order of preference: `CF-Connecting-IP`, then `X-Forwarded-For` read right to left (the first
  hop that is not loopback; an unparseable hop stops the scan, because everything left of it is
  client-controlled), then `X-Real-IP`.
- Any other peer is itself the client, and its headers are ignored.

Next's route handlers do not expose the socket, and Next fills `X-Forwarded-For` from the socket
only when the header is absent, so a direct client could forge that too. `src/instrumentation.ts`
wraps `http.Server.prototype.emit` at startup to copy `socket.remoteAddress` into an internal
header (`x-ip-info-peer`), deleting any client-supplied copy first. That works under plain
`next start` and `next dev`, without a custom server.

`TRUST_PROXY` overrides the default: `loopback` (default), `never` (only the peer counts) or
`always` (trust headers unconditionally; only safe when the app port cannot be reached except
through the proxy).

What this does not cover: if nginx itself is reachable without going through Cloudflare (a port
forward to it, for example), a client can set `CF-Connecting-IP` there and nginx's loopback peer
makes the app believe it. Close that in nginx: accept the site only from the tunnel, or overwrite
`CF-Connecting-IP` with `$remote_addr` for anything else. Binding the app to `127.0.0.1`
(`next start -H 127.0.0.1`) removes the direct-to-app path entirely.

## Local intelligence

- **Range classification** (`ranges.ts`) from the IANA IPv4 and IPv6 special-purpose registries.
  Private, CGNAT, loopback, link-local, multicast, documentation, benchmarking, reserved and
  anything outside `2000::/3` are answered on the server with the range, its RFC and a one-line
  explanation (`source.provider: "local"`). IPv4-mapped IPv6 is judged by its IPv4 part.
- **Reverse DNS** with `node:dns`'s `Resolver` (one try, hard timeout, default 1500 ms), in
  parallel with the provider call. PTR answers are untrusted, so only plain hostnames are kept.
  Non-public addresses are never resolved: that would query the server's LAN resolver and could
  expose hostnames from the network it sits on.

## Providers

| Provider | Role | Terms (quoted from their sites, November 2026) |
|---|---|---|
| [FreeIPAPI](https://freeipapi.com) | primary | "free and open-source IP geolocation API for commercial and non-commercial use"; "10 requests per 10 seconds, up to 60 requests per minute"; no key |
| [ipapi.co](https://ipapi.co) | fallback | keyless tier "up to 1000 / day", "Suitable for testing / development", "Not for production use" ([pricing](https://ipapi.co/pricing/)) |

FreeIPAPI is first because its terms allow this use. ipapi.co stays as a fallback because it
fills fields FreeIPAPI leaves empty (postal code, a single timezone) and it is what the app used
before; with its terms, it should not carry production traffic on its own. Order is set with
`IP_PROVIDERS`.

Normalisation is conservative: FreeIPAPI's `timeZones` lists every zone of the country, so a
timezone is only reported when there is exactly one; coordinates outside valid ranges become
`null`; nothing is guessed.

## Caching and limits

| What | Value | Where |
|---|---|---|
| Result cache | 2000 entries, 6 h TTL, LRU | `LIMITS.cache` in `instance.ts` |
| Per-client limit | burst of 30, refills 30/min | `LIMITS.client` |
| Upstream budget (all clients together) | burst of 30, refills 30/min | `LIMITS.upstream` |
| Provider timeout | 2500 ms each | `PROVIDER_TIMEOUT_MS` |
| Reverse DNS timeout | 1500 ms | `RDNS_TIMEOUT_MS` |

Concurrent lookups of one address share one upstream request. Failures are not cached. The
per-client limit covers `/api/*` and `/lookup/*`; looking up your own address (home, My IP) is
not limited per client because it is one cache entry per visitor, and the upstream budget still
applies.

## Testing

```sh
npm test          # Vitest, no network
npm run typecheck
npm run lint
```

The suite covers parsing (including agreement with `node:net`'s `isIP`), range classification
with block edges, provider normalisation, the HTTP helper's error mapping (429 with
`Retry-After`, bad status, non-JSON, network failure, timeout under fake timers), the cache and
limiter on an injected clock, the trust model (including spoofing from a non-loopback peer), the
peer stamp against a real `http.Server`, the service (fallback, 429 vs 502, cache, in-flight
dedupe, budget), and the route handlers end to end, validating every response body against the
published JSON Schema.

Provider fixtures in `src/lib/ip/__fixtures__/` are real responses recorded once with curl on
2026-11-20, except `ipapi-ratelimited.json`, which is built from the 429 body documented at
[ipapi.co/api](https://ipapi.co/api/):

| File | Request |
|---|---|
| `freeipapi-1.1.1.1.json` | `GET https://free.freeipapi.com/api/v1/json/1.1.1.1` |
| `freeipapi-2606-4700-4700--1111.json` | `GET https://free.freeipapi.com/api/v1/json/2606:4700:4700::1111` |
| `freeipapi-invalid.json` | `GET https://free.freeipapi.com/api/v1/json/not-an-ip` (HTTP 200, every field null) |
| `ipapi-1.1.1.1.json` | `GET https://ipapi.co/1.1.1.1/json/` |
| `ipapi-invalid.json` | `GET https://ipapi.co/999.1.1.1/json/` (HTTP 200, `error: true`) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and a production build on Node 22.

## Decisions and trade-offs

- **Providers are called from the server, not the browser.** One schema, input validated before
  any request, visitors' browsers never talk to third parties, and private ranges cost nothing.
  The cost: every visitor now shares the server's provider quota, which is why there is a cache,
  in-flight dedupe and a global upstream budget.
- **Peer stamping instead of a custom server.** A custom `server.js` would expose the socket too,
  but it changes how the app is started and would be silently skipped by anything that runs
  `next start` directly. The stamp is a few lines, idempotent, and tested.
- **In-memory cache and limiter.** The app is one process on one machine, so a `Map` is enough
  and has no moving parts. Both reset on restart and are per process; running several instances
  would need a shared store (Redis) for both.
- **Server-rendered lookup pages.** `/lookup/1.1.1.1` is shareable, has real metadata, and works
  without JavaScript (the search form falls back to a GET that redirects). Rendering costs a
  server lookup, which the cache absorbs.
- **Invalid addresses in a URL render an explanation (with `noindex`) rather than a bare 404**, so
  the page can show what was typed and offer the search.
- **CSP keeps `'unsafe-inline'` for scripts and styles.** Next's inline RSC payload and the theme
  script need it; nonces would force every page to render dynamically. Everything else is pinned
  to this origin plus OpenStreetMap's tile server. `.dev` is HSTS-preloaded, so no HSTS header.
- **No CORS.** A keyless API that any web page could call would turn the server into a free
  proxy for other sites' traffic and burn the shared provider quota.
- **The map opens at city zoom.** IP geolocation is city-level at best; a street-level view
  would claim precision the data does not have.

## Design

Dark is the "observatory" palette of [xvlad.dev](https://xvlad.dev): navy `#0A0F1E`, warm gold
`#E8B85D`, mono labels. Light is a cool paper counterpart that uses a deeper amber (`#8A5A00`)
for text. Type is Space Grotesk with Geist Mono for addresses and labels, both self-hosted by
`next/font`. Computed WCAG contrast for the main pairs:

| Pair | Ratio |
|---|---|
| dark text `#EEF1F6` on `#0A0F1E` | 16.86 |
| dark muted `#8A93A6` on card `#111829` | 5.74 |
| gold `#E8B85D` on `#0A0F1E` | 10.41 |
| navy on gold (primary button) | 10.41 |
| light text `#0A0F1E` on `#F4F6FA` | 17.65 |
| light muted `#4B566B` on `#F4F6FA` | 6.83 |
| light amber `#8A5A00` on white | 5.93 |
| light focus ring `#A86E0A` on `#F4F6FA` (non-text, needs 3) | 3.96 |

## Running

```sh
npm install
npm run dev                 # http://localhost:3000
npm run build && npm start  # production, as on the Pi
```

`next build` fetches the two fonts from Google Fonts once, so the build machine needs internet
access.

| Variable | Default | Purpose |
|---|---|---|
| `IP_PROVIDERS` | `freeipapi,ipapi` | provider order |
| `PROVIDER_TIMEOUT_MS` | `2500` | per-provider timeout |
| `RDNS_TIMEOUT_MS` | `1500` | reverse DNS timeout |
| `TRUST_PROXY` | `loopback` | `loopback`, `always` or `never` (see the trust model) |
| `SITE_URL` | `https://ip.xvlad.dev` | absolute URLs in metadata and docs |
