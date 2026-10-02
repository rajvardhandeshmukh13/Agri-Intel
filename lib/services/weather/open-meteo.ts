// lib/services/weather/open-meteo.ts
// Open-Meteo weather provider (free, no API key required).
// Docs: https://open-meteo.com/en/docs

import type { IWeatherService } from './interface';
import type { WeatherObservation, WeatherForecast, WeatherSummary, WeatherCode } from '@/lib/types/weather';

const BASE_URL = process.env.OPEN_METEO_BASE_URL ?? 'https://api.open-meteo.com/v1/';
const REQUEST_TIMEOUT_MS = 6000;

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

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const signal = typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  return fetch(url, { signal });
}

function mapWmoCode(code: number): WeatherCode {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly_cloudy';
  if (code <= 3) return 'cloudy';
  if (code <= 49) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'rain'; // snow — unlikely in Maharashtra, map to rain
  if (code <= 82) return 'rain';
  if (code <= 86) return 'heavy_rain';
  if (code <= 99) return 'thunderstorm';
  return 'partly_cloudy';
}

function wmoDescription(code: number, rain: number): string {
  if (rain > 25) return 'Heavy monsoon rain';
  if (rain > 10) return 'Moderate to heavy rain';
  if (rain > 2) return 'Light rain showers';
  if (code === 0) return 'Clear and sunny';
  if (code <= 2) return 'Clear to partly cloudy';
  if (code <= 3) return 'Overcast / cloudy';
  if (code <= 49) return 'Foggy conditions';
  if (code <= 67) return 'Rain expected';
  if (code <= 99) return 'Thunderstorm possible';
  return 'Variable conditions';
}

export class OpenMeteoWeatherService implements IWeatherService {
  async getHistoricalWeather(lat: number, lng: number, days = 90): Promise<WeatherObservation[]> {
    if (!isValidCoordinate(lat, lng)) {
      throw new Error(`Invalid coordinates for weather request: lat=${lat}, lng=${lng}`);
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - days);

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      start_date: startDate.toISOString().split('T')[0]!,
      end_date: endDate.toISOString().split('T')[0]!,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max',
      timezone: 'Asia/Kolkata',
    });

    const res = await fetchWithTimeout(`${BASE_URL}forecast?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo historical fetch failed: HTTP ${res.status}`);
    const data = await res.json() as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        relative_humidity_2m_max?: number[];
      };
    };

    if (!data?.daily?.time || !Array.isArray(data.daily.time)) {
      throw new Error('Malformed Open-Meteo response: daily time array missing');
    }

    return data.daily.time.map((date, i) => ({
      farmId: `${lat},${lng}`,
      observedAt: new Date(date).toISOString(),
      tempMaxC: data.daily?.temperature_2m_max?.[i] ?? 0,
      tempMinC: data.daily?.temperature_2m_min?.[i] ?? 0,
      rainfallMm: data.daily?.precipitation_sum?.[i] ?? 0,
      humidityPct: data.daily?.relative_humidity_2m_max?.[i] ?? 0,
      isForecast: false,
      source: 'open-meteo' as const,
    }));
  }

  async getForecast(lat: number, lng: number, days = 14): Promise<WeatherForecast> {
    if (!isValidCoordinate(lat, lng)) {
      throw new Error(`Invalid coordinates for weather request: lat=${lat}, lng=${lng}`);
    }

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      forecast_days: Math.min(Math.max(days, 1), 16).toString(),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max,weathercode',
      timezone: 'Asia/Kolkata',
    });

    const res = await fetchWithTimeout(`${BASE_URL}forecast?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo forecast fetch failed: HTTP ${res.status}`);
    const data = await res.json() as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        relative_humidity_2m_max?: number[];
        weathercode?: number[];
      };
    };

    if (!data?.daily?.time || !Array.isArray(data.daily.time) || data.daily.time.length === 0) {
      throw new Error('Malformed Open-Meteo response: daily forecast array missing');
    }

    return {
      farmId: `${lat},${lng}`,
      generatedAt: new Date().toISOString(),
      source: 'live' as const,
      days: data.daily.time.map((date, i) => {
        const rain = data.daily?.precipitation_sum?.[i] ?? 0;
        const wmoCode = data.daily?.weathercode?.[i] ?? 0;
        return {
          date,
          tempMaxC: data.daily?.temperature_2m_max?.[i] ?? 0,
          tempMinC: data.daily?.temperature_2m_min?.[i] ?? 0,
          rainfallMm: rain,
          humidityPct: data.daily?.relative_humidity_2m_max?.[i] ?? 0,
          weatherCode: mapWmoCode(wmoCode),
          description: wmoDescription(wmoCode, rain),
          isExtremeRisk: rain > 25 || wmoCode >= 95,
        };
      }),
    };
  }

  async getSummary(lat: number, lng: number): Promise<WeatherSummary> {
    const forecast = await this.getForecast(lat, lng, 7);
    const today = forecast.days[0];
    if (!today) throw new Error('No forecast data available from Open-Meteo');

    const weeklyRainfall = forecast.days.reduce((sum, d) => sum + d.rainfallMm, 0);
    const nextRainDay = forecast.days.find((d) => d.rainfallMm > 2);
    const extremeDays = forecast.days.filter((d) => d.isExtremeRisk);

    const alerts: string[] = [];
    if (extremeDays.length > 0) {
      alerts.push(`Heavy rain forecast (${extremeDays[0]!.rainfallMm}mm) on ${extremeDays[0]!.date}`);
    }

    return {
      currentTempC: today.tempMaxC,
      todayRainfallMm: today.rainfallMm,
      weeklyRainfallMm: parseFloat(weeklyRainfall.toFixed(1)),
      nextRainDate: nextRainDay?.date,
      extremeAlerts: alerts,
      weatherCode: today.weatherCode,
      description: today.description,
      source: 'live' as const,
    };
  }
}
