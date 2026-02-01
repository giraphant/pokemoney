import { SCAN_INTERVAL_MS, DRY_RUN } from './config.js';
import { getWallet } from './signer.js';
import { scanOnce } from './scanner.js';
import { executeOpportunity } from './executor.js';
import { logScanResult, logExecution, logStats } from './logger.js';

async function main() {
  const wallet = getWallet();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Scan interval: ${SCAN_INTERVAL_MS}ms`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('Starting scanner...\n');

  let cycle = 0;
  while (true) {
    cycle++;
    try {
      const opportunities = await scanOnce();
      logScanResult(opportunities);

      if (opportunities.length > 0) {
        const best = opportunities[0];
        if (DRY_RUN) {
          console.log(
            `[DRY RUN] Would execute: ${best.pairLabel} @$${best.usdTier} | loss=${best.roundTripLossBps.toFixed(1)}bps | profit=$${best.estimatedProfit.toFixed(3)}`
          );
        } else {
          const result = await executeOpportunity(best);
          logExecution(result);
        }
      }

      if (cycle % 10 === 0) logStats();
    } catch (err) {
      console.error('Cycle error:', err);
    }

    await new Promise((r) => setTimeout(r, SCAN_INTERVAL_MS));
  }
}

main().catch(console.error);
