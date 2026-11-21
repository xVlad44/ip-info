'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  lat: number;
  lon: number;
  /** Accessible description of what the map shows. */
  label: string;
}

/**
 * Leaflet map pinned at the provider's coordinates. Zoom 10 on purpose:
 * IP geolocation is city-level at best, and a street-level view would claim
 * a precision the data does not have.
 */
function MapComponent({ lat, lon, label }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [lat, lon],
      zoom: 10,
      scrollWheelZoom: false, // never hijack page scrolling
      dragging: !L.Browser.mobile, // one-finger drags scroll the page on phones
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 13,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.marker([lat, lon], {
      icon: L.divIcon({ className: 'ip-marker', iconSize: [28, 28], iconAnchor: [14, 14] }),
      keyboard: false,
      interactive: false,
    }).addTo(map);

    // The container can change size with the layout (fonts, breakpoints).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [lat, lon]);

  return <div ref={containerRef} role="img" aria-label={label} className="absolute inset-0" />;
}

export default MapComponent;
