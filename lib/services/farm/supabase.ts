// lib/services/farm/supabase.ts
// Supabase-backed implementation of IFarmStorage with seamless LocalStorage fallback.

import type { IFarmStorage } from './interface';
import { LocalFarmStorage } from './local';
import type { StoredFarm } from '@/lib/utils/farm-storage';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/auth/supabase';

export class SupabaseFarmStorage implements IFarmStorage {
  private localFallback = new LocalFarmStorage();

  getStoredFarmSync(): StoredFarm | null {
    // Synchronous reads always pull from the local cached copy
    return this.localFallback.getStoredFarmSync();
  }

  async getFarm(userId?: string): Promise<StoredFarm | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured() || !userId) {
      return this.localFallback.getFarm(userId);
    }

    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[SupabaseFarmStorage] Query error, falling back to local:', error.message);
        return this.localFallback.getFarm(userId);
      }

      if (data) {
        const stored: StoredFarm = {
          id: data.id,
          userId: data.user_id,
          name: data.name,
          crop: data.crop,
          commodity: data.commodity || data.crop,
          state: data.state,
          district: data.district,
          village: data.village,
          areaHectares: data.area_hectares,
          sowingDate: data.sowing_date,
          soilType: data.soil_type,
          irrigationType: data.irrigation_type,
          lat: data.lat,
          lng: data.lng,
          fieldGeoJson: data.field_geojson,
          inputCosts: data.input_cost_per_ha,
          inputCostPerHa: data.input_cost_per_ha,
          createdAt: data.created_at,
        };

        // Cache in local storage for synchronous reads
        await this.localFallback.saveFarm(stored, userId);
        return stored;
      }

      return this.localFallback.getFarm(userId);
    } catch (err) {
      console.warn('[SupabaseFarmStorage] Network/DB exception, falling back to local:', err);
      return this.localFallback.getFarm(userId);
    }
  }

  async saveFarm(farm: StoredFarm, userId?: string): Promise<void> {
    // Always write to local storage first for instant feedback & offline resiliency
    await this.localFallback.saveFarm(farm, userId);

    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      return;
    }

    const effectiveUserId = userId || farm.userId;
    if (!effectiveUserId || effectiveUserId.startsWith('demo-') || effectiveUserId === 'local-user') {
      // In demo mode or offline user, skip cloud sync
      return;
    }

    try {
      const payload = {
        id: farm.id || `farm-${Date.now()}`,
        user_id: effectiveUserId,
        name: farm.name || 'My Farm',
        crop: farm.crop,
        commodity: farm.commodity || farm.crop,
        state: farm.state || 'Maharashtra',
        district: farm.district || 'Latur',
        village: farm.village || '',
        area_hectares: typeof farm.areaHectares === 'number' ? farm.areaHectares : parseFloat(String(farm.areaHectares || 3.5)),
        sowing_date: farm.sowingDate,
        soil_type: farm.soilType,
        irrigation_type: farm.irrigationType,
        lat: farm.lat ?? farm.latitude,
        lng: farm.lng ?? farm.longitude,
        field_geojson: farm.fieldGeoJson,
        input_cost_per_ha: farm.inputCostPerHa ?? farm.inputCosts,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('farms').upsert(payload);
      if (error) {
        console.warn('[SupabaseFarmStorage] Upsert warning (kept in local):', error.message);
      }
    } catch (err) {
      console.warn('[SupabaseFarmStorage] Cloud sync failed, local copy preserved:', err);
    }
  }

  async resetToDemo(): Promise<void> {
    await this.localFallback.resetToDemo();
  }
}
