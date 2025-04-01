'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon issue
const icon = L.icon({
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapComponent({ lat, lon, city, country }: { lat: number; lon: number; city: string; country: string }) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Make sure we're in the browser environment
    if (typeof window !== 'undefined') {
      // Set default icon for all markers
      L.Marker.prototype.options.icon = icon;
      
      // Create map if it doesn't exist yet
      if (!mapRef.current && mapContainerRef.current) {
        mapRef.current = L.map(mapContainerRef.current).setView([lat, lon], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapRef.current);
        
        L.marker([lat, lon])
          .addTo(mapRef.current)
          .bindPopup(`<b>${city}</b><br>${country}`)
          .openPopup();
      } else if (mapRef.current) {
        // Update map view if it already exists
        mapRef.current.setView([lat, lon], 13);
        
        // Clear existing markers
        mapRef.current.eachLayer(layer => {
          if (layer instanceof L.Marker) {
            mapRef.current?.removeLayer(layer);
          }
        });
        
        // Add new marker
        L.marker([lat, lon])
          .addTo(mapRef.current)
          .bindPopup(`<b>${city}</b><br>${country}`)
          .openPopup();
      }
    }
    
    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon, city, country]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}

export default MapComponent;