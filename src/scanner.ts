import { getOrder, OrderResponse } from './ultra.js';
import { getWallet } from './signer.js';
import { PAIRS, AMOUNT_TIERS_USD, CARD_EV_USD } from './config.js';
import { fetchPrices } from './prices.js';

export interface Opportunity {
  pairLabel: string;
  mintA: string;
  mintB: string;
  amountA: string;
  amountB: string;
  orderAB: OrderResponse;
  orderBA: OrderResponse;
  roundTripLossBps: number;
  thresholdBps: number;
  cardMultiplier: number;
  estimatedProfit: number;
  usdTier: number;
}

const TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': 6,
};

function toRawAmount(mint: string, usdAmount: number, prices: Record<string, number>): string {
  const decimals = TOKEN_DECIMALS[mint] ?? 6;
  const price = prices[mint] ?? 1;
  const tokenAmount = usdAmount / price;
  return Math.floor(tokenAmount * 10 ** decimals).toString();
}

export async function scanOnce(): Promise<Opportunity[]> {
  const taker = getWallet().publicKey.toBase58();
  const prices = await fetchPrices();
  const opportunities: Opportunity[] = [];

  for (const [mintA, mintB, multiplier] of PAIRS) {
    for (const usdTier of AMOUNT_TIERS_USD) {
      try {
        const rawA = toRawAmount(mintA, usdTier, prices);
        const rawB = toRawAmount(mintB, usdTier, prices);

        const [orderAB, orderBA] = await Promise.all([
          getOrder(mintA, mintB, rawA, taker),
          getOrder(mintB, mintA, rawB, taker),
        ]);

        // Calculate round-trip efficiency.
        // orderAB: inA of A → outB of B
        // orderBA: inB of B → outA of A
        // If we do both, starting with inA of A:
        //   we get outB of B, then converting outB back using BA rate:
        //   effectiveReturn = outA * (outB / inB)
        const inA = Number(orderAB.inAmount);
        const outB = Number(orderAB.outAmount);
        const inB = Number(orderBA.inAmount);
        const outA = Number(orderBA.outAmount);

        const effectiveReturn = outA * (outB / inB);
        const lossBps = ((inA - effectiveReturn) / inA) * 10000;

        // Volume: ~2 * usdTier, cards = (2 * usdTier / 10000) * multiplier
        const cardsEarned = (2 * usdTier / 10000) * multiplier;
        const cardReward = cardsEarned * CARD_EV_USD;
        const lossDollars = (lossBps / 10000) * usdTier;
        const profit = cardReward - lossDollars;
        const thresholdBps = (cardReward / usdTier) * 10000;

        opportunities.push({
          pairLabel: `${mintA.slice(0, 4)}/${mintB.slice(0, 4)}`,
          mintA,
          mintB,
          amountA: rawA,
          amountB: rawB,
          orderAB,
          orderBA,
          roundTripLossBps: lossBps,
          thresholdBps,
          cardMultiplier: multiplier,
          estimatedProfit: profit,
          usdTier,
        });
      } catch (err) {
        console.error(`Scan error ${mintA.slice(0, 4)}/${mintB.slice(0, 4)} @$${usdTier}:`, err);
      }
    }
  }

  return opportunities
    .filter((o) => o.roundTripLossBps < o.thresholdBps)
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}
