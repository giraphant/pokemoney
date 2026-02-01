import dotenv from 'dotenv';
dotenv.config();

export const MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
} as const;

// [tokenA, tokenB, cardMultiplier]
export const PAIRS: [string, string, number][] = [
  [MINTS.JLP, MINTS.SOL, 1],
  [MINTS.JLP, MINTS.USDC, 1],
  [MINTS.JLP, MINTS.USDT, 1],
];

export const AMOUNT_TIERS_USD = [5000, 2000, 1000, 500];

export const CARD_EV_USD = 2.1;

export const MAX_RESIDUAL_USD = 100;

export const SCAN_INTERVAL_MS = 10_000;

export const ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';
export const JUP_API_KEY = process.env.JUP_API_KEY || '';

export const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export const DRY_RUN = process.env.DRY_RUN !== 'false';
