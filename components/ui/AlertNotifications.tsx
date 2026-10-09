'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, CloudRain, TrendingUp, Wheat, X } from 'lucide-react';
import { getActiveFarmContext } from '@/lib/utils/farm-storage';
import type { WeatherForecast } from '@/lib/types/weather';
import type { SellRecommendation } from '@/lib/types/recommendation';

type AlertItem = {
  id: string;
  title: string;
  message: string;
  icon: 'weather' | 'price' | 'sell';
  severity: 'high' | 'medium' | 'info';
};

const SEEN_KEY = 'agriintel-alerts-seen';
const SENT_KEY = 'agriintel-browser-alerts-sent';

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export default function AlertNotifications() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      if ('Notification' in window) setPermission(Notification.permission);
      setEnabled(localStorage.getItem('agriintel-browser-alerts') === 'true');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const farm = getActiveFarmContext();

    async function loadAlerts() {
      const next: AlertItem[] = [];
      try {
        const payload = {
          farmSeasonId: farm.id,
          crop: farm.crop,
          commodity: farm.commodity,
          areaHectares: farm.areaHectares,
          sowingDate: farm.sowingDate,
          district: farm.district,
          village: farm.village,
          state: farm.state,
          lat: farm.lat,
          lng: farm.lng,
          inputCostPerHa: farm.inputCostPerHa,
          inputCostTotal: farm.inputCostTotal,
          soilType: farm.soilType,
          irrigationType: farm.irrigationType,
          totalHarvestQ: farm.totalHarvestQ,
        };

        const [recRes, weatherRes] = await Promise.all([
          fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          fetch(`/api/weather?lat=${farm.lat}&lng=${farm.lng}&action=forecast&days=14`),
        ]);

        const recJson = recRes.ok ? await recRes.json() : null;
        const weatherJson = weatherRes.ok ? await weatherRes.json() : null;
        const rec = recJson?.data as SellRecommendation | undefined;
        const weather = weatherJson?.data as WeatherForecast | undefined;

        if (weather?.days?.some((day) => day.isExtremeRisk || day.rainfallMm >= 20)) {
          const riskyDay = weather.days.find((day) => day.isExtremeRisk || day.rainfallMm >= 20)!;
          next.push({
            id: `weather-${riskyDay.date}`,
            title: 'Weather alert',
            message: `Heavy/extreme weather is expected around ${formatDate(riskyDay.date)}. Harvest or transport may be delayed.`,
            icon: 'weather',
            severity: 'high',
          });
        } else if (weather?.days?.some((day) => day.rainfallMm >= 10)) {
          const rainDay = weather.days.find((day) => day.rainfallMm >= 10)!;
          next.push({
            id: `rain-${rainDay.date}`,
            title: 'Rain expected',
            message: `Rain is expected around ${formatDate(rainDay.date)}. Plan drying and transport accordingly.`,
            icon: 'weather',
            severity: 'medium',
          });
        }

        if (rec?.recommendedWindow === 'now') {
          next.push({
            id: `sell-${rec.recommendedSellingStartDate ?? 'now'}`,
            title: 'Selling opportunity',
            message: `Market conditions are favorable. Your practical selling window starts ${formatDate(rec.recommendedSellingStartDate)}.`,
            icon: 'sell',
            severity: 'info',
          });
        } else if (rec?.recommendedSellingStartDate) {
          next.push({
            id: `window-${rec.recommendedSellingStartDate}-${rec.recommendedSellingEndDate}`,
            title: 'Selling window updated',
            message: `Recommended selling window: ${formatDate(rec.recommendedSellingStartDate)}–${formatDate(rec.recommendedSellingEndDate)}.`,
            icon: 'sell',
            severity: 'info',
          });
        }

        if (rec?.reasons?.some((reason) => reason.toLowerCase().includes('prices have risen'))) {
          next.push({
            id: `price-${rec.generatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}`,
            title: 'Price trend alert',
            message: `${farm.crop.charAt(0).toUpperCase() + farm.crop.slice(1)} prices are trending upward. Check the market analysis before selling.`,
            icon: 'price',
            severity: 'medium',
          });
        }
      } catch (error) {
        console.warn('[AlertNotifications] Failed to load alerts:', error);
      }

      if (!cancelled) {
        const finalAlerts = next.slice(0, 4);
        setAlerts(finalAlerts);

        // If the farmer has already enabled browser alerts, notify only for new alert IDs.
        const isAlertsEnabled = localStorage.getItem('agriintel-browser-alerts') === 'true';
        if (isAlertsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const sent = new Set<string>(JSON.parse(localStorage.getItem(SENT_KEY) || '[]'));
            finalAlerts.filter((alert) => !sent.has(alert.id)).slice(0, 2).forEach((alert) => {
              new Notification(`AgriIntel: ${alert.title}`, { body: alert.message });
              sent.add(alert.id);
            });
            localStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
          } catch {
            // Ignore browser notification storage errors.
          }
        }
      }
    }

    loadAlerts();
    const refresh = window.setInterval(loadAlerts, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  const seen = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    } catch {
      return new Set<string>();
    }
  }, []);

  const unreadCount = alerts.filter((alert) => !seen.has(alert.id)).length;

  function markAllRead() {
    const ids = alerts.map((alert) => alert.id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    setOpen(false);
    setAlerts((current) => [...current]);
  }

  async function enableBrowserAlerts() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      localStorage.setItem('agriintel-browser-alerts', 'true');
      setEnabled(true);
      const sent = new Set<string>(JSON.parse(localStorage.getItem(SENT_KEY) || '[]'));
      alerts.filter((a) => !sent.has(a.id)).slice(0, 2).forEach((alert) => {
        new Notification(`AgriIntel: ${alert.title}`, { body: alert.message });
        sent.add(alert.id);
      });
      localStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
    }
  }

  function iconFor(alert: AlertItem) {
    if (alert.icon === 'weather') return <CloudRain className="h-4 w-4" />;
    if (alert.icon === 'price') return <TrendingUp className="h-4 w-4" />;
    return <Wheat className="h-4 w-4" />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
        title="Farm alerts"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[9px] leading-4 text-white font-bold text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-label="Close alerts" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-bold">Farm alerts</p>
                <p className="text-[10px] text-muted-foreground">Weather, prices & selling window</p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="p-1.5 rounded-md hover:bg-muted" title="Mark all read">
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No active alerts for this farm.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`px-4 py-3 flex gap-3 ${seen.has(alert.id) ? 'opacity-70' : ''}`}>
                    <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                      alert.severity === 'high' ? 'bg-red-100 text-red-600' : alert.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                    }`}>
                      {iconFor(alert)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{alert.title}</p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                    {!seen.has(alert.id) && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border px-4 py-3 bg-muted/30">
              {permission === 'denied' ? (
                <p className="text-[10px] text-muted-foreground">Browser notifications are blocked. Allow notifications for AgriIntel in your browser settings.</p>
              ) : enabled ? (
                <p className="text-[10px] text-emerald-700 font-medium">✓ Browser alerts enabled</p>
              ) : (
                <button type="button" onClick={enableBrowserAlerts} className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  🔔 Enable browser notifications
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
