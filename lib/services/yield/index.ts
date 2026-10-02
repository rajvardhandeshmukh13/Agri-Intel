// lib/services/yield/index.ts
// Centralized yield prediction service and fallback orchestrator.
// Connects the FastAPI ML sidecar as primary provider with deterministic heuristic fallback.

import { IYieldService } from './interface';
import { MLServiceAdapter } from './ml-service';
import { DeterministicYieldService } from './fallback';
import type { YieldModelInputV1, YieldPrediction } from '@/lib/types/yield';

export * from './interface';
export * from './ml-service';
export * from './fallback';

export const liveMLService: IYieldService = new MLServiceAdapter();
export const deterministicYieldService: IYieldService = new DeterministicYieldService();

export interface YieldPredictionOptions {
  forceDemo?: boolean;
  mlService?: IYieldService;
}

/**
 * Predict yield using the FastAPI ML service as primary provider,
 * falling back to the deterministic baseline on timeout, network failure,
 * missing service, or schema error.
 */
export async function predictYieldWithFallback(
  input: YieldModelInputV1,
  options: YieldPredictionOptions = {}
): Promise<YieldPrediction> {
  if (options.forceDemo) {
    const demoPrediction = await deterministicYieldService.predictYield(input);
    return {
      ...demoPrediction,
      source: 'demo',
    };
  }

  const mlProvider = options.mlService ?? liveMLService;

  try {
    const mlPrediction = await mlProvider.predictYield(input);
    return {
      ...mlPrediction,
      source: 'ml',
    };
  } catch (err) {
    console.warn(
      `[YieldService] Live ML service unavailable for crop "${input.crop}", using deterministic fallback:`,
      err instanceof Error ? err.message : err
    );
    const fallbackPrediction = await deterministicYieldService.predictYield(input);
    return {
      ...fallbackPrediction,
      source: 'fallback',
    };
  }
}
