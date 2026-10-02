// lib/services/farm/interface.ts
// Canonical interface for farm profile persistence across Supabase and local storage.

import type { StoredFarm } from '@/lib/utils/farm-storage';

export interface IFarmStorage {
  /**
   * Asynchronously retrieves the stored farm for the given user,
   * falling back to local storage or demo data if absent.
   */
  getFarm(userId?: string): Promise<StoredFarm | null>;

  /**
   * Persists the farm profile into active storage (Supabase if available, localStorage otherwise).
   */
  saveFarm(farm: StoredFarm, userId?: string): Promise<void>;

  /**
   * Resets stored farm profile to the canonical deterministic demo state.
   */
  resetToDemo(): Promise<void>;

  /**
   * Synchronous accessor for immediate client-side component hydration.
   */
  getStoredFarmSync(): StoredFarm | null;
}
