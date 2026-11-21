/**
 * JSON Schema (draft 2020-12) for the API's responses. Published on /docs and
 * checked against real normalised fixtures in the test suite, so it cannot
 * drift from the LookupResult type unnoticed.
 */
const nullableString = { type: ['string', 'null'] } as const;
const nullableNumber = { type: ['number', 'null'] } as const;

export const SCOPES = [
  'public',
  'private',
  'shared',
  'loopback',
  'link-local',
  'multicast',
  'documentation',
  'benchmarking',
  'unspecified',
  'broadcast',
  'reserved',
] as const;

export const lookupResultSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://ip.xvlad.dev/schema/lookup-result.json',
  title: 'LookupResult',
  type: 'object',
  required: ['ip', 'version', 'scope', 'range', 'hostname', 'location', 'network', 'source'],
  additionalProperties: false,
  properties: {
    ip: { type: 'string', description: 'Canonical form: dotted quad, or RFC 5952 IPv6.' },
    version: { enum: [4, 6] },
    scope: { enum: SCOPES },
    range: {
      type: ['object', 'null'],
      description: 'Special-purpose range the address is in; null for public addresses.',
      required: ['cidr', 'name', 'rfc', 'note'],
      additionalProperties: false,
      properties: {
        cidr: { type: 'string' },
        name: { type: 'string' },
        rfc: { type: 'string' },
        note: { type: 'string' },
      },
    },
    hostname: { ...nullableString, description: 'Reverse DNS (PTR); public addresses only.' },
    location: {
      type: ['object', 'null'],
      description: 'Null for non-public addresses.',
      required: ['city', 'region', 'regionCode', 'country', 'countryCode', 'continentCode', 'postalCode', 'latitude', 'longitude', 'timezone'],
      additionalProperties: false,
      properties: {
        city: nullableString,
        region: nullableString,
        regionCode: nullableString,
        country: nullableString,
        countryCode: { ...nullableString, description: 'ISO 3166-1 alpha-2.' },
        continentCode: nullableString,
        postalCode: nullableString,
        latitude: nullableNumber,
        longitude: nullableNumber,
        timezone: { ...nullableString, description: 'IANA zone, only when unambiguous.' },
      },
    },
    network: {
      type: ['object', 'null'],
      required: ['asn', 'organization'],
      additionalProperties: false,
      properties: {
        asn: { type: ['integer', 'null'] },
        organization: nullableString,
      },
    },
    source: {
      type: 'object',
      required: ['provider', 'cached', 'retrievedAt'],
      additionalProperties: false,
      properties: {
        provider: { enum: ['freeipapi', 'ipapi', 'local'] },
        cached: { type: 'boolean' },
        retrievedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const apiErrorSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://ip.xvlad.dev/schema/api-error.json',
  title: 'ApiError',
  type: 'object',
  required: ['error'],
  additionalProperties: false,
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      additionalProperties: false,
      properties: {
        code: {
          enum: ['invalid_ip', 'rate_limited', 'upstream_rate_limited', 'upstream_unavailable', 'client_ip_unknown', 'internal'],
        },
        message: { type: 'string' },
        retryAfter: { type: 'integer', description: 'Seconds; present on 429.' },
      },
    },
  },
} as const;
