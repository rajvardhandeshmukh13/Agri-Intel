// components/farm/FieldLocationPicker.tsx
// Interactive Leaflet map tool for selecting farm location and drawing precise field boundary polygon.
// Supports manual coordinate input, GPS geolocation, map click/tap, draggable pin, and vertex drawing.

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

// Controller to smoothly pan map and invalidate size on mount / resize so tiles never break
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after paint to resolve missing tile quadrants
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 700);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [map]);

  useEffect(() => {
    map.setView(center, 16, { animate: true });
    map.invalidateSize();
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

/**
 * Parses coordinate strings such as "16.8524, 74.5815" or "16.8524 74.5815"
 */
function parseCoordinatePair(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)[,\s;/]+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
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
    const coords = geoJsonToLeaflet(
      initialPolygon && validatePolygon(initialPolygon)
        ? initialPolygon
        : generateBoxPolygon(initialLat, initialLng)
    );
    return calculatePolygonAreaHectares(coords);
  });
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');

  // Manual Coordinates Input Drawer State
  const [showCoordInput, setShowCoordInput] = useState(false);
  const [inputLat, setInputLat] = useState(initialLat.toFixed(5));
  const [inputLng, setInputLng] = useState(initialLng.toFixed(5));
  const [coordError, setCoordError] = useState<string | null>(null);

  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: 'agriintel-center-pin',
      html: `
        <div style="
          background: #2563eb;
          color: white;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          border: 2px solid white;
          cursor: grab;
        ">
          📍
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }, []);

  // Sync state if coordinates changed externally (e.g. user selected different district)
  if (initialLat !== prevCoords.lat || initialLng !== prevCoords.lng) {
    setPrevCoords({ lat: initialLat, lng: initialLng });
    setCenter([initialLat, initialLng]);
    setInputLat(initialLat.toFixed(5));
    setInputLng(initialLng.toFixed(5));
    if (!initialPolygon) {
      const box = generateBoxPolygon(initialLat, initialLng);
      setFinalPolygon(box);
      setCalculatedArea(calculatePolygonAreaHectares(geoJsonToLeaflet(box)));
    }
  }

  // Handle click on map
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(5));
      const roundedLng = Number(lng.toFixed(5));

      if (isDrawing) {
        // Add vertex
        setDrawingPoints((prev) => {
          const next = [...prev, [roundedLat, roundedLng] as [number, number]];
          if (next.length >= 3) {
            setStatusMsg(`Point ${next.length} added. Tap 'Finish Boundary' or close polygon.`);
          } else {
            setStatusMsg(`Point ${next.length} added. Tap at least 3 points to outline field.`);
          }
          return next;
        });
      } else {
        // Move center
        setCenter([roundedLat, roundedLng]);
        setInputLat(roundedLat.toFixed(5));
        setInputLng(roundedLng.toFixed(5));
        const box = generateBoxPolygon(roundedLat, roundedLng);
        setFinalPolygon(box);
        const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
        setCalculatedArea(area);
        setStatusMsg(`📍 Pin set to (${roundedLat}, ${roundedLng}). Field boundary placed.`);
        onLocationChange({
          lat: roundedLat,
          lng: roundedLng,
          polygon: box,
          areaHectares: area,
        });
      }
    },
    [isDrawing, onLocationChange]
  );

  // Apply manual coordinates entered by user
  const handleApplyCoordinates = useCallback(() => {
    setCoordError(null);
    let lat = parseFloat(inputLat.trim());
    let lng = parseFloat(inputLng.trim());

    // Check if user pasted both in latitude box (e.g., "16.8524, 74.5815")
    const parsedPair = parseCoordinatePair(inputLat);
    if (parsedPair) {
      lat = parsedPair.lat;
      lng = parsedPair.lng;
      setInputLat(lat.toFixed(5));
      setInputLng(lng.toFixed(5));
    }

    if (isNaN(lat) || isNaN(lng)) {
      setCoordError('Please enter valid numerical latitude and longitude.');
      return;
    }

    if (lat < -90 || lat > 90) {
      setCoordError('Latitude must be between -90 and 90.');
      return;
    }

    if (lng < -180 || lng > 180) {
      setCoordError('Longitude must be between -180 and 180.');
      return;
    }

    const roundedLat = Number(lat.toFixed(5));
    const roundedLng = Number(lng.toFixed(5));

    setCenter([roundedLat, roundedLng]);
    setInputLat(roundedLat.toFixed(5));
    setInputLng(roundedLng.toFixed(5));

    const box = generateBoxPolygon(roundedLat, roundedLng);
    setFinalPolygon(box);
    const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
    setCalculatedArea(area);
    setStatusMsg(`✅ Map updated to coordinates: ${roundedLat}, ${roundedLng}`);
    setShowCoordInput(false);

    onLocationChange({
      lat: roundedLat,
      lng: roundedLng,
      polygon: box,
      areaHectares: area,
    });
  }, [inputLat, inputLng, onLocationChange]);

  // GPS Locate
  const handleUseGps = useCallback(() => {
    if (!navigator.geolocation) {
      setStatusMsg('GPS not supported on this browser.');
      return;
    }
    setStatusMsg('Locating your position via GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setCenter([lat, lng]);
        setInputLat(lat.toFixed(5));
        setInputLng(lng.toFixed(5));
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
        setStatusMsg('Could not fetch GPS location. Please tap the map or enter coordinates.');
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
    const avgLat = Number((drawingPoints.reduce((sum, p) => sum + p[0], 0) / drawingPoints.length).toFixed(5));
    const avgLng = Number((drawingPoints.reduce((sum, p) => sum + p[1], 0) / drawingPoints.length).toFixed(5));

    setCenter([avgLat, avgLng]);
    setInputLat(avgLat.toFixed(5));
    setInputLng(avgLng.toFixed(5));
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
          className="text-xs px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-medium flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>📍</span> GPS Location
        </button>

        <button
          type="button"
          onClick={() => {
            setShowCoordInput(!showCoordInput);
            setCoordError(null);
          }}
          className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-colors cursor-pointer ${
            showCoordInput
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:bg-muted text-foreground'
          }`}
        >
          <span>🎯</span> Enter Coords
        </button>

        {!isDrawing ? (
          <button
            type="button"
            onClick={handleStartDrawing}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>✏️</span> Draw Field Boundary
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 3}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer ${
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
              className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground ml-auto cursor-pointer"
          title="Reset boundary to standard box"
        >
          <span>↺</span> Reset
        </button>
      </div>

      {/* Manual Coordinates Input Drawer */}
      {showCoordInput && (
        <div className="bg-card border border-border p-3 rounded-xl shadow-sm space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>🎯</span> Enter Latitude & Longitude
            </span>
            <span className="text-[10px] text-muted-foreground">
              Tip: Paste &apos;lat, lng&apos; directly
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                Latitude (e.g. 16.8524)
              </label>
              <input
                type="text"
                placeholder="16.8524"
                value={inputLat}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputLat(val);
                  const p = parseCoordinatePair(val);
                  if (p) {
                    setInputLat(p.lat.toFixed(5));
                    setInputLng(p.lng.toFixed(5));
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                Longitude (e.g. 74.5815)
              </label>
              <input
                type="text"
                placeholder="74.5815"
                value={inputLng}
                onChange={(e) => setInputLng(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary"
              />
            </div>
          </div>

          {coordError && (
            <p className="text-[11px] text-destructive font-medium">{coordError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCoordInput(false)}
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCoordinates}
              className="px-3.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Apply Coordinates
            </button>
          </div>
        </div>
      )}

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
              maxNativeZoom={18}
              maxZoom={19}
              crossOrigin="anonymous"
              keepBuffer={4}
            />
          ) : (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              crossOrigin="anonymous"
              keepBuffer={4}
            />
          )}
          <MapCenterController center={center} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Draggable Center Marker */}
          <Marker
            position={center}
            icon={markerIcon}
            draggable={!isDrawing}
            eventHandlers={{
              dragend(e) {
                const marker = e.target;
                const pos = marker.getLatLng();
                const roundedLat = Number(pos.lat.toFixed(5));
                const roundedLng = Number(pos.lng.toFixed(5));
                setCenter([roundedLat, roundedLng]);
                setInputLat(roundedLat.toFixed(5));
                setInputLng(roundedLng.toFixed(5));
                const box = generateBoxPolygon(roundedLat, roundedLng);
                setFinalPolygon(box);
                const area = calculatePolygonAreaHectares(geoJsonToLeaflet(box));
                setCalculatedArea(area);
                setStatusMsg(`📍 Pin moved to: ${roundedLat}, ${roundedLng}. Boundary updated.`);
                onLocationChange({
                  lat: roundedLat,
                  lng: roundedLng,
                  polygon: box,
                  areaHectares: area,
                });
              },
            }}
          />

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

      {/* Helper caption with interactive coordinates editor button */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <button
          type="button"
          onClick={() => {
            setShowCoordInput(true);
            setCoordError(null);
          }}
          className="hover:text-primary transition-colors flex items-center gap-1 font-mono cursor-pointer"
          title="Click to manually enter coordinates"
        >
          <span>Coords: {center[0].toFixed(4)}, {center[1].toFixed(4)}</span>
          <span className="text-[10px] text-primary font-sans underline ml-1">Edit Coords</span>
        </button>
        <span>Polygon: {finalPolygon.coordinates[0].length} points</span>
      </div>
    </div>
  );
}
