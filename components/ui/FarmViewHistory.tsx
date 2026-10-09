'use client';

import { useEffect, useState } from 'react';
import { getFarmViewHistory, clearFarmViewHistory, type FarmViewHistoryEntry } from '@/lib/utils/farm-view-history';

const ACCOUNTS_KEY = 'agriintel-accounts';
const ACTIVE_KEY = 'agriintel-active-account';

export default function FarmViewHistory() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FarmViewHistoryEntry[]>([]);

  const refresh = () => setItems(getFarmViewHistory());

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const onChange = () => refresh();
    window.addEventListener('storage', onChange);
    window.addEventListener('agriintel-farm-history', onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onChange);
      window.removeEventListener('agriintel-farm-history', onChange);
    };
  }, []);

  const revisit = (item: FarmViewHistoryEntry) => {
    try {
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as Array<{ id: string; farm: string; farmProfile?: Record<string, unknown> }>;
      const account = accounts.find((a) => a.id === item.id);
      if (!account) return;
      localStorage.setItem(ACTIVE_KEY, account.id);
      if (account.farmProfile) {
        localStorage.setItem('agriintel_farm', JSON.stringify({ ...account.farmProfile, name: account.farm }));
      }
      window.location.reload();
    } catch {
      // Keep the panel open if stored account data is malformed.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { refresh(); setOpen(true); }}
        className="text-xs text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer"
        aria-label="Farm view history"
        title="Farms viewed recently"
      >
        🕘
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Farm view history</h2>
                <p className="text-xs text-muted-foreground">Recently viewed farms on this device</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground cursor-pointer">✕</button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="text-2xl">🕘</p>
                <p className="mt-2 text-sm font-semibold">No farms viewed yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Switch between farmer profiles and they will appear here.</p>
              </div>
            ) : (
              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={`${item.id}-${item.viewedAt}`} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">🌾</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.farm}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.farmer} · {item.location}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Viewed {new Date(item.viewedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button type="button" onClick={() => revisit(item)} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted cursor-pointer">View</button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <button type="button" onClick={() => { clearFarmViewHistory(); refresh(); }} className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer">
                Clear view history
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
