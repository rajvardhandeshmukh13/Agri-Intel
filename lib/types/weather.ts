// lib/types/weather.ts
// Normalized weather data models — provider-agnostic

export interface WeatherObservation {
  farmId: string;
  observedAt: string; // ISO datetime
  tempMaxC: number;
  tempMinC: number;
  rainfallMm: number;
  humidityPct: number;
  isForecast: boolean;
  source: 'open-meteo' | 'openweathermap' | 'demo';
}

export interface WeatherForecast {
  farmId: string;
  generatedAt: string;
  days: WeatherDay[];
  source?: 'live' | 'open-meteo' | 'demo';
}

export interface WeatherDay {
  date: string; // ISO date
  tempMaxC: number;
  tempMinC: number;
  rainfallMm: number;
  humidityPct: number;
  weatherCode: WeatherCode;
  description: string;
  isExtremeRisk: boolean;
}

export type WeatherCode =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'thunderstorm'
  | 'fog'
  | 'heatwave';

export interface WeatherSummary {
  currentTempC: number;
  todayRainfallMm: number;
  weeklyRainfallMm: number;
  nextRainDate?: string;
  extremeAlerts: string[];
  weatherCode: WeatherCode;
  description: string;
  source?: 'live' | 'open-meteo' | 'demo';
}

export interface WeatherRisk {
  level: 'low' | 'moderate' | 'high';
  reasons: string[];
}
