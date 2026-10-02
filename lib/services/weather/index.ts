// lib/services/weather/index.ts
// Centralized weather service provider and fallback orchestration.
// Preserves the IWeatherService abstraction so underlying providers
// can be swapped (e.g. Open-Meteo, IMD, Tomorrow.io) without changing callers.

import { IWeatherService } from './interface';
import { OpenMeteoWeatherService } from './open-meteo';
import { DemoWeatherService } from './demo';
import type { WeatherForecast, WeatherSummary } from '@/lib/types/weather';

export * from './interface';
export * from './open-meteo';
export * from './demo';

export const liveWeatherService: IWeatherService = new OpenMeteoWeatherService();
export const demoWeatherService: IWeatherService = new DemoWeatherService();

export interface WeatherFetchOptions {
  forceDemo?: boolean;
  days?: number;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Fetch forecast with fallback:
 * 1. Checks if forceDemo is requested.
 * 2. Validates coordinates.
 * 3. Attempts live Open-Meteo service.
 * 4. Falls back to deterministic DemoWeatherService on any error, invalid coordinate, or timeout.
 * 5. Tags response with source ('live' | 'demo') and never claims demo is live.
 */
export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  options: WeatherFetchOptions = {}
): Promise<WeatherForecast> {
  const days = options.days ?? 14;

  if (options.forceDemo || !isValidCoordinate(lat, lng)) {
    const demoData = await demoWeatherService.getForecast(lat, lng, days);
    return { ...demoData, source: 'demo' };
  }

  try {
    const liveData = await liveWeatherService.getForecast(lat, lng, days);
    return { ...liveData, source: 'live' };
  } catch (err) {
    console.warn(
      `[WeatherService] Live weather fetch failed for (${lat}, ${lng}), using demo fallback:`,
      err instanceof Error ? err.message : err
    );
    const demoData = await demoWeatherService.getForecast(lat, lng, days);
    return { ...demoData, source: 'demo' };
  }
}

/**
 * Fetch weather summary with fallback:
 * 1. Checks if forceDemo is requested.
 * 2. Validates coordinates.
 * 3. Attempts live Open-Meteo service.
 * 4. Falls back to deterministic DemoWeatherService on any error, invalid coordinate, or timeout.
 * 5. Tags response with source ('live' | 'demo') and never claims demo is live.
 */
export async function fetchWeatherSummary(
  lat: number,
  lng: number,
  options: WeatherFetchOptions = {}
): Promise<WeatherSummary> {
  if (options.forceDemo || !isValidCoordinate(lat, lng)) {
    const demoData = await demoWeatherService.getSummary(lat, lng);
    return { ...demoData, source: 'demo' };
  }

  try {
    const liveData = await liveWeatherService.getSummary(lat, lng);
    return { ...liveData, source: 'live' };
  } catch (err) {
    console.warn(
      `[WeatherService] Live weather summary failed for (${lat}, ${lng}), using demo fallback:`,
      err instanceof Error ? err.message : err
    );
    const demoData = await demoWeatherService.getSummary(lat, lng);
    return { ...demoData, source: 'demo' };
  }
}
