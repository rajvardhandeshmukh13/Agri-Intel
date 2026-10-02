// components/farm/FieldLocationPicker.tsx
// Interactive Leaflet map tool for selecting farm location and drawing precise field boundary polygon.

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { validatePolygon } from '@/lib/services/satellite/utils';

export interface LocationResult {
  lat: number;
  lng: number;
  polygon: GeoJSON.Polygon;
  areaHectares: number;
}

export interface FieldLocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialPolygon?: GeoJSON.Polygon;
  district?: string;
  onLocationChange: (result: LocationResult) => void;
  className?: string;
}

import {
  calculatePolygonAreaHectares,
  generateBoxPolygon,
  verticesToGeoJson,
  geoJsonToLeaflet,
} from '@/lib/utils/geometry';

export {
  calculatePolygonAreaHectares,
  generateBoxPolygon,
  verticesToGeoJson,
  geoJsonToLeaflet,
};

// Controller to smoothly pan map when center changes externally
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [map, center]);
  return null;
}

// Map event handler for clicks and drawing
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FieldLocationPicker({
  initialLat = 18.2333,
  initialLng = 76.7167,
  initialPolygon,
  onLocationChange,
  className = '',
}: FieldLocationPickerProps) {
  const [prevCoords, setPrevCoords] = useState({ lat: initialLat, lng: initialLng });
  const [center, setCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [finalPolygon, setFinalPolygon] = useState<GeoJSON.Polygon>(() => {
    if (initialPolygon && validatePolygon(initialPolygon)) {
      return initialPolygon;
    }
    return generateBoxPolygon(initialLat, initialLng);
  });
  const [calculatedArea, setCalculatedArea] = useState<number>(() => {
    const coords = geoJsonToLeaflet(initialPolygon && validatePolygon(initialPolygon) ? initialPolygon : generateBoxPolygon(initialLat, initialLng));
    return calculatePolygonAreaHectares(coords);
  });
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');

  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: 'agriintel-center-pin',
      html: `
        <div style="
          background: #2563eb;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, []);

  // Sync state if coordinates changed externally (e.g. user selected different district)
  if (initialLat !== prevCoords.lat || initialLng !== prevCoords.lng) {
    setPrevCoords({ lat: initialLat, lng: initialLng });
    setCenter([initialLat, initialLng]);
    if (!initialPolygon) {
      const box = generateBoxPolygon(initialLat, initialLng);
      setFinalPolygon(box);
      setCalculatedArea(calculatePolygonAreaHectares(geoJsonToLeaflet(box)));
    }
  }

  // Handle click on map
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (isDrawing) {
        // Add vertex
        setDrawingPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          if (next.length >= 3) {
            setStatusMsg(`Point ${next.length} added. Click 'Finish Boundary' or double-click to close field.`);
          } else {
            setStatusMsg(`Point ${next.length} added. Click at least 3 points to outline your boundary.`);
          }
          return next;
        });
      } else {
        // Just move center
        setCenter([lat, lng]);
        const box = generateBoxPolygon(lat, lng);
        setFinalPolygon(box);
        const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
        setCalculatedArea(area);
        setStatusMsg('Farm position moved. Auto-generated field boundary placed.');
        onLocationChange({
          lat,
          lng,
          polygon: box,
          areaHectares: area,
        });
      }
    },
    [isDrawing, onLocationChange]
  );

  // GPS Locate
  const handleUseGps = useCallback(() => {
    if (!navigator.geolocation) {
      setStatusMsg('GPS not supported on this browser.');
      return;
    }
    setStatusMsg('Locating your position via GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter([lat, lng]);
        const box = generateBoxPolygon(lat, lng);
        setFinalPolygon(box);
        const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
        setCalculatedArea(area);
        setStatusMsg('📍 Located your current field position!');
        onLocationChange({
          lat,
          lng,
          polygon: box,
          areaHectares: area,
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setStatusMsg('Could not fetch GPS location. Please tap the map to place your farm.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onLocationChange]);

  // Start Drawing
  const handleStartDrawing = useCallback(() => {
    setIsDrawing(true);
    setDrawingPoints([]);
    setStatusMsg('Drawing mode active: Tap 3 or more corners of your field on the map.');
  }, []);

  // Finish Drawing
  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length < 3) {
      setStatusMsg('Please place at least 3 points to outline a field.');
      return;
    }

    const poly = verticesToGeoJson(drawingPoints);
    const area = calculatePolygonAreaHectares(drawingPoints);

    // Compute center as centroid of vertices
    const avgLat = drawingPoints.reduce((sum, p) => sum + p[0], 0) / drawingPoints.length;
    const avgLng = drawingPoints.reduce((sum, p) => sum + p[1], 0) / drawingPoints.length;

    setCenter([avgLat, avgLng]);
    setFinalPolygon(poly);
    setCalculatedArea(area);
    setIsDrawing(false);
    setDrawingPoints([]);
    setStatusMsg(`✅ Boundary completed! Calculated area: ${area} hectares.`);

    onLocationChange({
      lat: avgLat,
      lng: avgLng,
      polygon: poly,
      areaHectares: area,
    });
  }, [drawingPoints, onLocationChange]);

  // Cancel/Reset Drawing
  const handleReset = useCallback(() => {
    setIsDrawing(false);
    setDrawingPoints([]);
    const box = generateBoxPolygon(center[0], center[1]);
    setFinalPolygon(box);
    const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
    setCalculatedArea(area);
    setStatusMsg('Boundary reset to standard box.');

    onLocationChange({
      lat: center[0],
      lng: center[1],
      polygon: box,
      areaHectares: area,
    });
  }, [center, onLocationChange]);

  const leafletPolygon = useMemo(() => geoJsonToLeaflet(finalPolygon), [finalPolygon]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Map Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleUseGps}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-medium flex items-center gap-1 transition-colors"
        >
          <span>📍</span> GPS Location
        </button>

        {!isDrawing ? (
          <button
            type="button"
            onClick={handleStartDrawing}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1 transition-colors"
          >
            <span>✏️</span> Draw Field Boundary
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 3}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                drawingPoints.length >= 3
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <span>✅</span> Finish Boundary ({drawingPoints.length})
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground"
            >
              Cancel
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground ml-auto"
          title="Reset boundary to ~3.5 ha box"
        >
          <span>↺</span> Reset
        </button>
      </div>

      {/* Status banner */}
      {statusMsg && (
        <div className="bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-md text-[11px] text-primary">
          {statusMsg}
        </div>
      )}

      {/* Leaflet Map Box */}
      <div className="relative h-64 rounded-xl overflow-hidden border border-border shadow-sm">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={false}
          attributionControl={false}
          className="h-full w-full z-0"
        >
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
          <MapCenterController center={center} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Center Marker */}
          <Marker position={center} icon={markerIcon} />

          {/* Active drawing points & polyline */}
          {isDrawing && (
            <>
              {drawingPoints.map((pt, idx) => (
                <CircleMarker
                  key={idx}
                  center={pt}
                  radius={5}
                  pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 0.95 }}
                />
              ))}
              {drawingPoints.length >= 2 && (
                <Polyline positions={drawingPoints} pathOptions={{ color: '#38bdf8', weight: 3, dashArray: '4, 4' }} />
              )}
            </>
          )}

          {/* Stored/Completed Polygon */}
          {!isDrawing && leafletPolygon.length >= 3 && (
            <Polygon
              positions={leafletPolygon}
              pathOptions={{
                color: mapType === 'satellite' ? '#ffffff' : '#059669',
                weight: 2.5,
                fillColor: '#10b981',
                fillOpacity: mapType === 'satellite' ? 0.35 : 0.25,
              }}
            />
          )}
        </MapContainer>

        {/* Top-Right Map Controls: Satellite Toggle & Area Badge */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
          <div className="flex rounded-md bg-background/90 backdrop-blur-md p-0.5 border border-border shadow-sm text-[10px]">
            <button
              type="button"
              onClick={() => setMapType('satellite')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                mapType === 'satellite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🛰️ Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapType('streets')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                mapType === 'streets' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🗺️ Map
            </button>
          </div>
          <div className="bg-background/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-border text-[11px] font-semibold text-foreground shadow-sm">
            🌾 {calculatedArea} ha
          </div>
        </div>
      </div>

      {/* Helper caption */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>Coords: {center[0].toFixed(4)}, {center[1].toFixed(4)}</span>
        <span>Polygon: {finalPolygon.coordinates[0].length} points</span>
      </div>
    </div>
  );
}
