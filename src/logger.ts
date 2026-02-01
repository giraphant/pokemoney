import { Opportunity } from './scanner.js';
import { ExecutionResult } from './executor.js';
import { CARD_EV_USD } from './config.js';

let totalCards = 0;
let totalExecutions = 0;

export function logScanResult(opportunities: Opportunity[]) {
  const now = new Date().toISOString();
  if (opportunities.length === 0) {
    console.log(`[${now}] Scan: no profitable opportunities`);
    return;
  }
  for (const o of opportunities) {
    console.log(
      `[${now}] Found: ${o.pairLabel} @$${o.usdTier} | loss=${o.roundTripLossBps.toFixed(1)}bps | threshold=${o.thresholdBps.toFixed(1)}bps | profit=$${o.estimatedProfit.toFixed(3)}`
    );
  }
}

export function logExecution(result: ExecutionResult) {
  const now = new Date().toISOString();
  const o = result.opportunity;
  totalExecutions++;

  if (result.abSuccess && result.baSuccess) {
    const cards = (2 * o.usdTier / 10000) * o.cardMultiplier;
    totalCards += cards;
    console.log(
      `[${now}] EXECUTED: ${o.pairLabel} @$${o.usdTier} | AB=${result.abSignature?.slice(0, 8)} | BA=${result.baSignature?.slice(0, 8)} | loss=${o.roundTripLossBps.toFixed(1)}bps`
    );
  } else {
    console.log(
      `[${now}] FAILED: ${o.pairLabel} | AB=${result.abSuccess} BA=${result.baSuccess} | ${result.error || ''}`
    );
  }
}

export function logStats() {
  console.log(
    `--- Stats: executions=${totalExecutions} | est.cards=${totalCards.toFixed(1)} | est.reward=$${(totalCards * CARD_EV_USD).toFixed(2)} ---`
  );
}
