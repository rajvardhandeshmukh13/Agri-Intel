// lib/services/farm/index.ts
// Canonical entry point for farm storage abstraction.

import { SupabaseFarmStorage } from './supabase';
import type { IFarmStorage } from './interface';

export * from './interface';
export * from './local';
export * from './supabase';

// Canonical singleton farm storage instance
export const farmStorage: IFarmStorage = new SupabaseFarmStorage();
