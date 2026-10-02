// lib/services/yield/interface.ts
// Provider-agnostic yield prediction service interface.

import type { YieldModelInputV1, YieldPrediction } from '@/lib/types/yield';

export interface IYieldService {
  /**
   * Predict crop yield using farm, weather, satellite, and historical features.
   */
  predictYield(input: YieldModelInputV1): Promise<YieldPrediction>;

  /**
   * Check if the prediction service is available and healthy.
   */
  checkHealth?(): Promise<boolean>;
}
