// components/farm/FieldMap.tsx
// Interactive Leaflet field map component for AgriIntel.
// Features high-resolution Esri satellite imagery by default, toggleable street map,
// crisp perimeter boundary, and translucent NDVI crop-health zones.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HealthZone, HealthStatus } from '@/lib/types/satellite';

export interface FieldMapProps {
  lat: number;
  lng: number;
  farmName?: string;
  crop?: string;
  fieldBoundary?: [number, number][]; // [lat, lng] pairs
  healthZones?: HealthZone[];
  latestStatus?: HealthStatus;
  latestNdvi?: number;
  healthyPct?: number;
  moderatePct?: number;
  stressedPct?: number;
  className?: string;
}

/**
 * Auto-centers and fits map bounds smoothly with padding
 */
function MapController({ center, bounds }: { center: [number, number]; bounds?: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length >= 3) {
      try {
        const leafletBounds = L.latLngBounds(bounds.map(([lat, lng]) => [lat, lng]));
        map.fitBounds(leafletBounds, { padding: [35, 35], maxZoom: 16 });
      } catch {
        map.setView(center, 15);
      }
    } else {
      map.setView(center, 15);
    }
  }, [map, center, bounds]);

  return null;
}

export default function FieldMap({
  lat,
  lng,
  farmName = 'My Field',
  crop = 'Soybean',
  fieldBoundary,
  healthZones = [],
  latestStatus = 'moderate',
  latestNdvi = 0.62,
  healthyPct = 55,
  moderatePct = 35,
  stressedPct = 10,
  className = '',
}: FieldMapProps) {
  const [showZones, setShowZones] = useState(true);
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');

  // Validate coordinates
  const isValidCoord =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const center: [number, number] = isValidCoord ? [lat, lng] : [18.2333, 76.7167];

  // Self-contained farmer location marker
  const farmIcon = useMemo(() => {
    return L.divIcon({
      className: 'agriintel-farm-marker',
      html: `
        <div style="
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
          border: 2px solid #ffffff;
          cursor: pointer;
        ">
          🌱
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
  }, []);

  if (!isValidCoord) {
    return (
      <div className={`h-64 bg-muted/40 rounded-xl flex flex-col items-center justify-center p-4 text-center border border-border ${className}`}>
        <span className="text-3xl mb-1">🗺️</span>
        <p className="text-sm font-semibold text-foreground">Field Coordinates Not Configured</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Please update your farm location in Onboarding to visualize the field map.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative h-64 md:h-72 w-full rounded-xl overflow-hidden border border-border shadow-sm ${className}`}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <MapController center={center} bounds={fieldBoundary} />

        {/* High-Resolution Satellite Imagery vs Street Map */}
        {mapType === 'satellite' ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
        )}

        {/* Translucent Segmented Health Zones (NDVI remote sensing heatmap) */}
        {showZones &&
          healthZones.map((zone, idx) => {
            const isHealthy = zone.status === 'healthy';
            const isModerate = zone.status === 'moderate';
            const fillColor = isHealthy ? '#10b981' : isModerate ? '#f59e0b' : '#ef4444';

            return (
              <Polygon
                key={`health-zone-${zone.status}-${idx}`}
                positions={zone.polygon}
                pathOptions={{
                  color: 'rgba(255, 255, 255, 0.45)',
                  fillColor,
                  fillOpacity: mapType === 'satellite' ? 0.45 : 0.55,
                  weight: 1,
                }}
              >
                <Tooltip sticky direction="top">
                  <div className="text-xs font-sans p-0.5">
                    <span className="font-bold block text-foreground">
                      {zone.label || `${zone.status.toUpperCase()} ZONE`}
                    </span>
                    <span className="text-muted-foreground text-[11px] block">
                      {zone.description || `Area health: ${zone.status}`}
                    </span>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}

        {/* Outer Field Perimeter Boundary */}
        {fieldBoundary && fieldBoundary.length >= 3 && (
          <Polygon
            positions={fieldBoundary}
            pathOptions={{
              color: mapType === 'satellite' ? '#ffffff' : '#059669',
              weight: 2.5,
              dashArray: undefined,
              fillOpacity: showZones ? 0.0 : 0.15,
              fillColor: '#10b981',
            }}
          >
            <Tooltip sticky direction="center">
              <span className="text-xs font-semibold">{farmName} Boundary</span>
            </Tooltip>
          </Polygon>
        )}

        {/* Farmer Field Location Marker */}
        <Marker position={center} icon={farmIcon}>
          <Popup>
            <div className="text-xs font-sans p-1 min-w-[140px]">
              <p className="font-bold text-sm text-foreground">{farmName}</p>
              <p className="text-xs text-muted-foreground capitalize">{crop} Field</p>
              <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between items-center text-[11px]">
                <span className="text-muted-foreground">NDVI:</span>
                <span className="font-semibold text-primary">{latestNdvi.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{latestStatus}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Top Map Controls: Satellite Toggle & Zone Toggle */}
      <div className="absolute top-2.5 right-2.5 z-[500] flex items-center gap-1.5 bg-background/90 backdrop-blur-md rounded-lg p-1 shadow-md border border-border text-[11px]">
        {/* Imagery Switcher */}
        <div className="flex rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              mapType === 'satellite'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapType('streets')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              mapType === 'streets'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🗺️ Map
          </button>
        </div>

        {/* Overlay Mode Switcher */}
        <div className="flex rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setShowZones(true)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              showZones
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Health
          </button>
          <button
            type="button"
            onClick={() => setShowZones(false)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              !showZones
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Boundary
          </button>
        </div>
      </div>

      {/* Floating Coordinates Badge */}
      <div className="absolute bottom-2.5 left-2.5 z-[500] bg-background/90 backdrop-blur-md rounded-md px-2 py-1 shadow-md border border-border text-[10px] font-mono text-muted-foreground flex items-center gap-1">
        <span>📍</span> {center[0].toFixed(4)}°N, {center[1].toFixed(4)}°E
      </div>

      {/* Health Legend */}
      <div className="absolute bottom-2.5 right-2.5 z-[500] flex flex-col gap-1 bg-background/90 backdrop-blur-md rounded-lg p-2 shadow-md border border-border text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
          <span className="font-semibold text-foreground">Healthy ({healthyPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
          <span className="font-semibold text-foreground">Moderate ({moderatePct}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0" />
          <span className="font-semibold text-foreground">Stressed ({stressedPct}%)</span>
        </div>
      </div>
    </div>
  );
}
