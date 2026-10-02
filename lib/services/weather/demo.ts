// lib/services/weather/demo.ts
// Demo weather service — returns local JSON data.
// Used when NEXT_PUBLIC_DEMO_MODE=true or when the live API fails.

import type { IWeatherService } from './interface';
import type { WeatherObservation, WeatherForecast, WeatherSummary } from '@/lib/types/weather';
import forecastData from '@/data/demo/weather-forecast.json';

export class DemoWeatherService implements IWeatherService {
  async getHistoricalWeather(_lat: number, _lng: number, _days?: number): Promise<WeatherObservation[]> {
    // Generate synthetic 90-day history from known patterns
    const observations: WeatherObservation[] = [];
    const base = new Date('2024-10-01');
    const dayCount = _days ?? 90;
    for (let i = dayCount; i >= 1; i--) {
      const date = new Date(base);
      date.setDate(base.getDate() - i);
      const dayOfSeason = dayCount - i;
      // Simulate monsoon tapering pattern for Kharif season
      const rainfallMm = dayOfSeason < 60 ? Math.max(0, 15 - dayOfSeason * 0.2 + (Math.random() * 10)) : Math.random() * 5;
      observations.push({
        farmId: 'demo-soybean-maharashtra',
        observedAt: date.toISOString(),
        tempMaxC: 28 + Math.random() * 5,
        tempMinC: 20 + Math.random() * 4,
        rainfallMm: parseFloat(rainfallMm.toFixed(1)),
        humidityPct: 65 + Math.random() * 25,
        isForecast: false,
        source: 'demo',
      });
    }
    return observations;
  }

  async getForecast(_lat: number, _lng: number, _days?: number): Promise<WeatherForecast> {
    const daysToShow = _days ? forecastData.days.slice(0, _days) : forecastData.days;
    return {
      farmId: forecastData.farmId,
      generatedAt: forecastData.generatedAt,
      source: 'demo' as const,
      days: daysToShow.map((d) => ({
        date: d.date,
        tempMaxC: d.tempMaxC,
        tempMinC: d.tempMinC,
        rainfallMm: d.rainfallMm,
        humidityPct: d.humidityPct,
        weatherCode: d.weatherCode as WeatherSummary['weatherCode'],
        description: d.description,
        isExtremeRisk: d.isExtremeRisk,
      })),
    };
  }

  async getSummary(_lat: number, _lng: number): Promise<WeatherSummary> {
    void _lat;
    void _lng;
    const today = forecastData.days[0];
    const week = forecastData.days.slice(0, 7);
    const weeklyRainfall = week.reduce((sum, d) => sum + d.rainfallMm, 0);
    const nextRainDay = forecastData.days.find((d) => d.rainfallMm > 5);
    const extremeDays = forecastData.days.filter((d) => d.isExtremeRisk);

    return {
      currentTempC: today.tempMaxC,
      todayRainfallMm: today.rainfallMm,
      weeklyRainfallMm: parseFloat(weeklyRainfall.toFixed(1)),
      nextRainDate: nextRainDay?.date,
      extremeAlerts: extremeDays.map((d) => `Heavy rain expected on ${d.date}`),
      weatherCode: today.weatherCode as WeatherSummary['weatherCode'],
      description: today.description,
      source: 'demo' as const,
    };
  }
}
