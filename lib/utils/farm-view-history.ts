// Tracks farms viewed on this device. Kept separate from season/farm-performance history.

export type FarmViewHistoryEntry = {
  id: string;
  farmer: string;
  farm: string;
  location: string;
  crop?: string;
  viewedAt: string;
};

const KEY = 'agriintel-farm-view-history';
const MAX_ENTRIES = 30;

function read(): FarmViewHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getFarmViewHistory(): FarmViewHistoryEntry[] {
  return read();
}

export function recordFarmView(entry: Omit<FarmViewHistoryEntry, 'viewedAt'>): FarmViewHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const nextEntry = { ...entry, viewedAt: new Date().toISOString() };
  const previous = read().filter((item) => item.id !== entry.id);
  const next = [nextEntry, ...previous].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('agriintel-farm-history'));
  return next;
}

export function clearFarmViewHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('agriintel-farm-history'));
}
