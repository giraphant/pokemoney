import { JUP_API_KEY, MINTS, PRICE_CACHE_TTL_MS } from './config.js';

const PRICE_API_BASE = 'https://api.jup.ag/price/v2';

const headers: Record<string, string> = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

// Cache prices for a short duration to avoid hammering the API
let cachedPrices: Record<string, number> = {};
let cacheTime = 0;

export async function fetchPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - cacheTime < PRICE_CACHE_TTL_MS && Object.keys(cachedPrices).length > 0) {
    return cachedPrices;
  }

  const ids = Object.values(MINTS).join(',');
  const res = await fetch(`${PRICE_API_BASE}?ids=${ids}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Price API failed (${res.status}): ${body}`);
  }

  const json = await res.json() as {
    data: Record<string, { price: string }>;
  };

  const prices: Record<string, number> = {};
  for (const [mint, info] of Object.entries(json.data)) {
    prices[mint] = parseFloat(info.price);
  }

  // Stables default to 1 if not returned
  prices[MINTS.USDC] ??= 1;
  prices[MINTS.USDT] ??= 1;

  cachedPrices = prices;
  cacheTime = now;
  return prices;
}
