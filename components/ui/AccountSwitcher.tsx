// components/ui/AccountSwitcher.tsx
// Multiple farmer profiles on one device. Each profile keeps its own farm snapshot.

'use client';

import { useEffect, useState } from 'react';
import { getStoredFarm, saveStoredFarm, type StoredFarm } from '@/lib/utils/farm-storage';
import { recordFarmView } from '@/lib/utils/farm-view-history';

type Account = {
  id: string;
  farmer: string;
  farm: string;
  location: string;
  farmProfile?: StoredFarm;
};

const KEY = 'agriintel-accounts';
const ACTIVE = 'agriintel-active-account';

function snapshotFarm(profile: StoredFarm | null, fallbackName: string, fallbackLocation: string): StoredFarm {
  const [district = 'Latur', state = 'Maharashtra'] = fallbackLocation.split(',').map((v) => v.trim());
  return {
    ...(profile ?? {}),
    id: profile?.id || 'farm-default',
    name: profile?.name || fallbackName,
    district: profile?.district || district,
    state: profile?.state || state,
  };
}

export function AccountSwitcher({ fallbackName, fallbackLocation }: { fallbackName: string; fallbackLocation: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState('default');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ farmer: '', farm: '', location: '' });

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentFarm = getStoredFarm();
      const fallback: Account = {
        id: 'default',
        farmer: 'Suresh Patil',
        farm: fallbackName,
        location: fallbackLocation,
        farmProfile: snapshotFarm(currentFarm, fallbackName, fallbackLocation),
      };

      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Account[] | null;
        const storedAccounts = Array.isArray(saved) && saved.length ? saved : [fallback];
        const active = localStorage.getItem(ACTIVE) || storedAccounts[0].id;

        // Migrate the old label-only account format into real farm profiles.
        const migrated = storedAccounts.map((account) => ({
          ...account,
          farmProfile: account.farmProfile || (account.id === 'default' ? fallback.farmProfile : snapshotFarm(currentFarm, account.farm, account.location)),
        }));

        const activeAccount = migrated.find((a) => a.id === active) ?? migrated[0];
        setAccounts(migrated);
        setActiveId(activeAccount.id);
        recordFarmView({ id: activeAccount.id, farmer: activeAccount.farmer, farm: activeAccount.farm, location: activeAccount.location, crop: String(activeAccount.farmProfile?.crop || activeAccount.farmProfile?.commodity || '') });
        localStorage.setItem(KEY, JSON.stringify(migrated));
      } catch {
        setAccounts([fallback]);
        setActiveId('default');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [fallbackName, fallbackLocation]);

  useEffect(() => {
    const syncActiveProfile = () => {
      const current = getStoredFarm();
      if (!current || !activeId) return;
      setAccounts((prev) => {
        const updated = prev.map((account) => account.id === activeId ? { ...account, farmProfile: current, farm: current.name || account.farm } : account);
        localStorage.setItem(KEY, JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('storage', syncActiveProfile);
    return () => window.removeEventListener('storage', syncActiveProfile);
  }, [activeId]);

  const persistAccounts = (list: Account[], id: string) => {
    setAccounts(list);
    setActiveId(id);
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.setItem(ACTIVE, id);
  };

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const shownFarm = active?.farm || fallbackName;

  const switchAccount = (account: Account) => {
    if (account.farmProfile) {
      saveStoredFarm({ ...account.farmProfile, name: account.farm });
    }
    persistAccounts(accounts, account.id);
    recordFarmView({ id: account.id, farmer: account.farmer, farm: account.farm, location: account.location, crop: String(account.farmProfile?.crop || account.farmProfile?.commodity || '') });
    setOpen(false);
    // A full refresh ensures every dashboard screen reads the newly active farm profile.
    window.location.reload();
  };

  const add = () => {
    if (!form.farmer.trim() || !form.farm.trim()) return;
    const current = getStoredFarm();
    const location = form.location.trim() || fallbackLocation;
    const [district = 'Latur', state = 'Maharashtra'] = location.split(',').map((v) => v.trim());
    const profile = snapshotFarm(current, form.farm.trim(), location);
    profile.id = `farm-${crypto.randomUUID()}`;
    profile.name = form.farm.trim();
    profile.district = district;
    profile.state = state;

    const acc: Account = {
      id: crypto.randomUUID(),
      farmer: form.farmer.trim(),
      farm: form.farm.trim(),
      location,
      farmProfile: profile,
    };

    const list = [...accounts, acc];
    persistAccounts(list, acc.id);
    setForm({ farmer: '', farm: '', location: '' });
    setAdding(false);
    setOpen(false);
    saveStoredFarm(profile);
    recordFarmView({ id: acc.id, farmer: acc.farmer, farm: acc.farm, location: acc.location, crop: String(profile.crop || profile.commodity || '') });
    window.location.reload();
  };

  const remove = (id: string) => {
    if (accounts.length === 1) return;
    const list = accounts.filter((a) => a.id !== id);
    const nextId = id === activeId ? list[0].id : activeId;
    persistAccounts(list, nextId);
    if (id === activeId && list[0].farmProfile) {
      saveStoredFarm(list[0].farmProfile);
      window.location.reload();
    }
  };

  const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-muted-foreground leading-none px-1.5 py-1 rounded-md hover:bg-muted cursor-pointer max-w-[150px] truncate"
        title="Switch farmer profile"
      >
        {active?.farmer || 'Farmer'} · {shownFarm} ▾
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
          onClick={() => { setOpen(false); setAdding(false); }}
        >
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Farmer profiles</h2>
                <p className="text-xs text-muted-foreground">Multiple farmers can share this device.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground cursor-pointer">✕</button>
            </div>

            <ul className="mt-3 space-y-1">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted">
                  <button type="button" className="flex flex-1 items-center gap-3 text-left cursor-pointer" onClick={() => switchAccount(a)}>
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials(a.farmer)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{a.farmer}</span>
                      <span className="block text-xs text-muted-foreground truncate">{a.farm} · {a.location}</span>
                    </span>
                  </button>
                  {a.id === active?.id ? (
                    <span className="text-primary font-bold">✓</span>
                  ) : (
                    <button type="button" onClick={() => remove(a.id)} aria-label={`Remove ${a.farmer}`} className="cursor-pointer">🗑️</button>
                  )}
                </li>
              ))}
            </ul>

            {adding ? (
              <div className="mt-3 space-y-2">
                <input value={form.farmer} onChange={(e) => setForm({ ...form, farmer: e.target.value })} placeholder="Farmer name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                <input value={form.farm} onChange={(e) => setForm({ ...form, farm: e.target.value })} placeholder="Farm name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (e.g. Latur, Maharashtra)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                <button type="button" onClick={add} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground cursor-pointer">Add farmer profile</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl p-2 text-sm font-semibold text-primary hover:bg-muted cursor-pointer">
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-primary">+</span>
                Add farmer profile
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
