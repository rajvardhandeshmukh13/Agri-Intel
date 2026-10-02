// lib/services/weather/interface.ts
// Provider-agnostic weather service interface.
// All weather providers must implement this contract.

import type { WeatherObservation, WeatherForecast, WeatherSummary } from '@/lib/types/weather';

export interface IWeatherService {
  /**
   * Fetch historical weather observations for a farm location.
   * @param lat - Latitude
   * @param lng - Longitude
   * @param days - Number of past days to fetch (default 90)
   */
  getHistoricalWeather(lat: number, lng: number, days?: number): Promise<WeatherObservation[]>;

  /**
   * Fetch the weather forecast for a farm location.
   * @param lat - Latitude
   * @param lng - Longitude
   * @param days - Number of forecast days (default 14)
   */
  getForecast(lat: number, lng: number, days?: number): Promise<WeatherForecast>;

  /**
   * Get a summarized weather snapshot suitable for the dashboard.
   */
  getSummary(lat: number, lng: number): Promise<WeatherSummary>;
}
