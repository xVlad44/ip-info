'use client';

import dynamic from 'next/dynamic';
import { ExternalLink } from 'lucide-react';
import { formatCoordinates, osmUrl } from '@/lib/ip/format';

// Leaflet touches `window` at import time, so it only loads in the browser.
const MapComponent = dynamic(() => import('@/components/MapComp'), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />,
});

export function MapPanel({ lat, lon, place }: { lat: number; lon: number; place: string | null }) {
  const label = `Map centred on ${place ?? formatCoordinates(lat, lon)}`;
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative isolate aspect-[4/3] min-h-[240px] w-full overflow-hidden rounded-lg border border-border bg-surface-2 lg:aspect-auto lg:h-full lg:min-h-[340px]">
        <MapComponent lat={lat} lon={lon} label={label} />
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span>Approximate. IP geolocation is city-level at best.</span>
        <a
          href={osmUrl(lat, lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 underline decoration-line-strong underline-offset-4 hover:text-foreground hover:decoration-gold"
        >
          Open in OpenStreetMap
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}
