// lib/decision-engine/net-profit-engine.ts
// Net profit decision engine.
// Ranks candidate mandis by expected farm-gate net profit:
//   Net Profit = (Yield x Price) - Transport - Mandi Fees - Production Cost
// All outputs are labeled estimates — not guarantees.

import type {
  AgmarknetMandiData,
  ProfitBreakdown,
} from '@/lib/types/decision-engine';

export class NetProfitEngine {
  /**
   * Evaluates net profit across target mandis based on predicted yield,
   * freight costs, handling, and mandi statutory fees.
   */
  public static calculateNetProfit(
    fieldAreaHa: number,
    predictedYieldPerHa: number,
    productionCostPerHa: number,
    mandiList: AgmarknetMandiData[],
  ): ProfitBreakdown[] {
    const totalYieldQuintals = predictedYieldPerHa * fieldAreaHa;
    const totalProductionCost = productionCostPerHa * fieldAreaHa;

    const results: ProfitBreakdown[] = mandiList.map((mandi) => {
      const grossRevenue = totalYieldQuintals * mandi.modal_price_per_qtl;

      // Freight transport = distance * rate per km/qtl * total volume
      const transportCost =
        mandi.distance_km * mandi.freight_rate_per_km_qtl * totalYieldQuintals;

      // Statutory mandi tax + fixed handling costs
      const mandiFeeTax = grossRevenue * mandi.mandi_fee_pct;
      const handlingCosts = totalYieldQuintals * mandi.handling_cost_per_qtl;
      const totalMandiFees = mandiFeeTax + handlingCosts;

      // Net Profit = (Yield * Price) - Transport - Mandi Fees - Production Cost
      const netProfit =
        grossRevenue - transportCost - totalMandiFees - totalProductionCost;
      const profitMarginPct =
        grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

      return {
        mandi_id: mandi.mandi_id,
        mandi_name: mandi.mandi_name,
        predicted_yield_qtl: Number(totalYieldQuintals.toFixed(2)),
        gross_revenue: Number(grossRevenue.toFixed(2)),
        transport_cost: Number(transportCost.toFixed(2)),
        mandi_fees: Number(totalMandiFees.toFixed(2)),
        production_cost: Number(totalProductionCost.toFixed(2)),
        net_profit: Number(netProfit.toFixed(2)),
        profit_margin_pct: Number(profitMarginPct.toFixed(2)),
      };
    });

    // Rank mandis by highest net profit
    return results.sort((a, b) => b.net_profit - a.net_profit);
  }
}
