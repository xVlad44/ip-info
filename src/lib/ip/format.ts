import type { GeoLocation, NetworkInfo } from './types';

export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/** "Sydney, New South Wales, Australia", skipping parts that are missing or repeated. */
export function formatPlace(loc: GeoLocation | null): string | null {
  if (!loc) return null;
  const parts: string[] = [];
  for (const p of [loc.city, loc.region, loc.country]) {
    if (p && !parts.includes(p)) parts.push(p);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Short headline form: "Sydney, Australia". */
export function formatPlaceShort(loc: GeoLocation | null): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.country].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? [...new Set(parts)].join(', ') : null;
}

export function formatAsn(network: NetworkInfo | null): string | null {
  return network?.asn ? `AS${network.asn}` : null;
}

/** Deterministic (server and client agree): "2026-11-20 23:53 UTC". */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function osmUrl(lat: number, lon: number, zoom = 10): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}
