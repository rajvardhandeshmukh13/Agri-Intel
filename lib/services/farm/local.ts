// lib/services/farm/local.ts
// LocalStorage & deterministic demo implementation of IFarmStorage.

import type { IFarmStorage } from './interface';
import type { StoredFarm } from '@/lib/utils/farm-storage';

const STORAGE_KEY = 'agriintel_farm';

export class LocalFarmStorage implements IFarmStorage {
  getStoredFarmSync(): StoredFarm | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredFarm;
    } catch (e) {
      console.warn('[LocalFarmStorage] Error reading localStorage:', e);
      return null;
    }
  }

  async getFarm(_userId?: string): Promise<StoredFarm | null> {
    void _userId;
    return this.getStoredFarmSync();
  }

  async saveFarm(farm: StoredFarm, _userId?: string): Promise<void> {
    void _userId;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(farm));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('[LocalFarmStorage] Error writing to localStorage:', e);
    }
  }

  async resetToDemo(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('[LocalFarmStorage] Error resetting to demo:', e);
    }
  }
}
