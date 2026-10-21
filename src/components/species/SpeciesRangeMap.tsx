import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface SpeciesRangeMapProps {
  coordinates?: { latitude: number; longitude: number };
  locationName?: string;
  speciesName: string;
  nativeRegion: string;
  biomes: string[];
}

export const SpeciesRangeMap: React.FC<SpeciesRangeMapProps> = ({
  coordinates = { latitude: 26.0173, longitude: 76.5026 },
  locationName = 'Protected Wildlife Reserve',
  speciesName,
  nativeRegion,
  biomes,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Avoid duplicate initialization
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const { latitude, longitude } = coordinates;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      // CartoDB Positron / Voyager or OpenStreetMap free tiles (no API key required)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Add custom minimal zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Habitat Core Range Circle (Resident Protected Zone)
      const coreRange = L.circle([latitude, longitude], {
        color: '#1b5e20',
        fillColor: '#2e7d32',
        fillOpacity: 0.35,
        radius: 45000, // 45km radius
        weight: 2,
      }).addTo(map);

      // Historical / Buffer Dispersal Zone
      const bufferRange = L.circle([latitude, longitude], {
        color: '#825500',
        fillColor: '#ffb020',
        fillOpacity: 0.15,
        radius: 95000, // 95km radius
        dashArray: '4, 8',
        weight: 1.5,
      }).addTo(map);

      // Custom Botanical Pin Icon
      const customIcon = L.divIcon({
        className: 'wilddex-map-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #00450d;
            border: 2.5px solid #acf4a4;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <span class="material-symbols-outlined" style="font-size: 18px;">nature</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 2px;">
          <strong style="color: #00450d; font-size: 13px;">${speciesName}</strong><br/>
          <span style="color: #555;">${locationName}</span><br/>
          <span style="color: #1b5e20; font-weight: 600;">Active Wildlife Telemetry</span>
        </div>
      `);

      mapInstanceRef.current = map;

      // Handle resize
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } catch (err) {
      console.warn('Leaflet map initialization skipped or failed:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coordinates, locationName, speciesName]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([coordinates.latitude, coordinates.longitude], 7, { animate: true });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 bg-surface-container-high">
      <div ref={mapContainerRef} className="w-full h-64 sm:h-72 z-0"></div>

      {/* Map Control HUD */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
        <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-sm">
          <span className="material-symbols-outlined text-[13px] text-secondary">explore</span>
          <span>{nativeRegion}</span>
        </span>
        <button
          onClick={handleRecenter}
          className="w-7 h-7 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface flex items-center justify-center shadow-sm hover:bg-surface active:scale-95 transition-all"
          title="Recenter Map"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">my_location</span>
        </button>
      </div>

      {/* Map Legend HUD */}
      <div className="absolute bottom-2.5 inset-x-2.5 p-2.5 rounded-xl bg-surface/90 backdrop-blur-md shadow-md flex items-center justify-between z-10 border border-outline-variant/20">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary-container ring-1 ring-primary-fixed"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Core Range (45km)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-tertiary-container ring-1 ring-tertiary-fixed"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Dispersal Corridor</span>
          </div>
        </div>
        <span className="text-[11px] text-on-surface-variant font-mono">
          {coordinates.latitude.toFixed(3)}°N, {coordinates.longitude.toFixed(3)}°E
        </span>
      </div>
    </div>
  );
};
