import dotenv from 'dotenv';
dotenv.config();

export const MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
};

// PAIRS env format: "JLP/SOL:1,JLP/USDC:1,JLP/USDT:1"
// Each entry is "TOKENA/TOKENB:multiplier"
function parsePairs(env: string | undefined): [string, string, number][] {
  const raw = env || 'JLP/SOL:1,JLP/USDC:1,JLP/USDT:1';
  return raw.split(',').map((entry) => {
    const [pair, mult] = entry.trim().split(':');
    const [a, b] = pair.split('/');
    const mintA = MINTS[a];
    const mintB = MINTS[b];
    if (!mintA || !mintB) throw new Error(`Unknown token symbol in pair: ${pair}`);
    return [mintA, mintB, Number(mult || 1)];
  });
}

// AMOUNT_TIERS env format: "5000,2000,1000,500"
function parseAmountTiers(env: string | undefined): number[] {
  const raw = env || '5000,2000,1000,500';
  return raw.split(',').map((s) => Number(s.trim()));
}

export const PAIRS = parsePairs(process.env.PAIRS);
export const AMOUNT_TIERS_USD = parseAmountTiers(process.env.AMOUNT_TIERS);
export const CARD_EV_USD = Number(process.env.CARD_EV_USD || '2.1');
export const MAX_RESIDUAL_USD = Number(process.env.MAX_RESIDUAL_USD || '100');
export const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS || '10000');
export const PRICE_CACHE_TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS || '30000');

export const ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';
export const JUP_API_KEY = process.env.JUP_API_KEY || '';
export const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
export const DRY_RUN = process.env.DRY_RUN !== 'false';
