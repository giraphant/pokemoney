# JLP Volume Farmer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A TypeScript bot that farms Jupiter campaign volume by doing round-trip swaps (A→B→A) on JLP pairs via Ultra API, only executing when the round-trip cost is below the expected card reward value.

**Architecture:** Single long-running Node.js process. Each cycle: concurrently fetch two Ultra orders (A→B and B→A) for each pair/amount combo, calculate round-trip loss, execute both if profitable. Dockerized for easy server deployment.

**Tech Stack:** TypeScript, Node.js 20+, `@solana/web3.js@1`, `bs58`, `dotenv`, Docker

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Initialize project**

```bash
cd /home/ramu/pokemoney
npm init -y
npm install @solana/web3.js@1 bs58 dotenv
npm install -D typescript @types/node tsx
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .env.example**

```
PRIVATE_KEY=your-base58-encoded-private-key
JUP_API_KEY=your-jupiter-api-key
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.env
```

**Step 5: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc
CMD ["node", "dist/index.js"]
```

**Step 6: Create docker-compose.yml**

```yaml
services:
  farmer:
    build: .
    env_file: .env
    restart: unless-stopped
```

**Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: project scaffolding"
```

---

### Task 2: Config Module

**Files:**
- Create: `src/config.ts`

**Step 1: Write config.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config();

// Token mint addresses
export const MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
} as const;

// Trading pairs to scan: [tokenA, tokenB, cardMultiplier]
export const PAIRS: [string, string, number][] = [
  [MINTS.JLP, MINTS.SOL, 1],
  [MINTS.JLP, MINTS.USDC, 1],
  [MINTS.JLP, MINTS.USDT, 1],
];

// Amount tiers to try (in USD value, converted to token amounts at runtime)
// We use raw lamport/token amounts, so these are approximate USD tiers
export const AMOUNT_TIERS_USD = [5000, 2000, 1000, 500];

// Expected value per card in USD
export const CARD_EV_USD = 2.1;

// Max allowed residual imbalance in USD before rebalancing
export const MAX_RESIDUAL_USD = 100;

// Scan interval in milliseconds
export const SCAN_INTERVAL_MS = 10_000;

// Jupiter Ultra API
export const ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';
export const JUP_API_KEY = process.env.JUP_API_KEY || '';

// Wallet
export const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
```

**Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: add config module"
```

---

### Task 3: Wallet/Signer Module

**Files:**
- Create: `src/signer.ts`

**Step 1: Write signer.ts**

```typescript
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { PRIVATE_KEY } from './config.js';

let _wallet: Keypair | null = null;

export function getWallet(): Keypair {
  if (!_wallet) {
    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env');
    _wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  }
  return _wallet;
}

export function signTransaction(base64Tx: string): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, 'base64'));
  tx.sign([getWallet()]);
  return Buffer.from(tx.serialize()).toString('base64');
}
```

**Step 2: Commit**

```bash
git add src/signer.ts
git commit -m "feat: add signer module"
```

---

### Task 4: Ultra API Client

**Files:**
- Create: `src/ultra.ts`

**Step 1: Write ultra.ts**

```typescript
import { ULTRA_API_BASE, JUP_API_KEY } from './config.js';

export interface OrderResponse {
  transaction: string;
  requestId: string;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  priceImpact: string;
  slippageBps: number;
  feeBps: string;
}

export interface ExecuteResponse {
  status: 'Success' | 'Failed';
  signature: string;
  slot: number;
  totalInputAmount: string;
  totalOutputAmount: string;
  code?: number;
  error?: string;
}

const headers: Record<string, string> = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

export async function getOrder(
  inputMint: string,
  outputMint: string,
  amount: string,
  taker: string
): Promise<OrderResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    taker,
  });
  const res = await fetch(`${ULTRA_API_BASE}/order?${params}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Order failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function execute(
  signedTransaction: string,
  requestId: string
): Promise<ExecuteResponse> {
  const res = await fetch(`${ULTRA_API_BASE}/execute`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction, requestId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Execute failed (${res.status}): ${body}`);
  }
  return res.json();
}
```

**Step 2: Commit**

```bash
git add src/ultra.ts
git commit -m "feat: add Ultra API client"
```

---

### Task 5: Scanner Module

**Files:**
- Create: `src/scanner.ts`

**Step 1: Write scanner.ts**

```typescript
import { getOrder, OrderResponse } from './ultra.js';
import { getWallet } from './signer.js';
import { PAIRS, AMOUNT_TIERS_USD, CARD_EV_USD } from './config.js';

export interface Opportunity {
  pairLabel: string;
  mintA: string;
  mintB: string;
  amountA: string;        // raw amount for A→B
  amountB: string;        // raw amount for B→A (estimated)
  orderAB: OrderResponse;
  orderBA: OrderResponse;
  roundTripLossBps: number;
  thresholdBps: number;
  cardMultiplier: number;
  estimatedProfit: number; // USD: card reward - loss
}

// For now, use hardcoded SOL price and JLP price.
// TODO: derive from order responses or external price feed.
const TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,      // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,   // USDT
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': 6,   // JLP
};

function toRawAmount(mint: string, usdAmount: number, priceUsd: number): string {
  const decimals = TOKEN_DECIMALS[mint] ?? 6;
  const tokenAmount = usdAmount / priceUsd;
  return Math.floor(tokenAmount * 10 ** decimals).toString();
}

export async function scanOnce(): Promise<Opportunity[]> {
  const taker = getWallet().publicKey.toBase58();
  const opportunities: Opportunity[] = [];

  for (const [mintA, mintB, multiplier] of PAIRS) {
    for (const usdTier of AMOUNT_TIERS_USD) {
      try {
        // We need a rough price to convert USD to raw token amount.
        // Use a small probe order to get the rate, or hardcode for now.
        // For simplicity, request both orders concurrently with estimated amounts.

        // For JLP (mintA), approximate: 1 JLP ≈ $4 (check actual price)
        // For SOL: ≈ $200, USDC/USDT: $1
        // These are rough - the exact amounts don't matter much,
        // we care about the round-trip ratio.

        // First, get A→B order
        const rawA = toRawAmount(mintA, usdTier, 4); // JLP ≈ $4

        // Get both orders concurrently
        // For B→A, estimate how much B we'd get
        const priceB = mintB.startsWith('So1') ? 200 : 1; // SOL vs stables
        const rawB = toRawAmount(mintB, usdTier, priceB);

        const [orderAB, orderBA] = await Promise.all([
          getOrder(mintA, mintB, rawA, taker),
          getOrder(mintB, mintA, rawB, taker),
        ]);

        // Calculate round-trip loss
        // If we start with X of A, swap to B, then swap equivalent B back to A:
        // orderAB: rawA → outAmountB
        // orderBA: rawB → outAmountA
        // The ratio tells us the round-trip efficiency
        const inA = Number(orderAB.inAmount);
        const outB = Number(orderAB.outAmount);
        const inB = Number(orderBA.inAmount);
        const outA = Number(orderBA.outAmount);

        // Normalize: if we put in inA of token A,
        // we get outB of token B.
        // If we then put outB of token B back,
        // we'd get outA * (outB / inB) of token A.
        const effectiveReturn = outA * (outB / inB);
        const lossBps = ((inA - effectiveReturn) / inA) * 10000;

        // Volume generated: ~2 * usdTier (one each direction)
        // Cards earned: (2 * usdTier / 10000) * multiplier
        const cardsEarned = (2 * usdTier / 10000) * multiplier;
        const cardReward = cardsEarned * CARD_EV_USD;
        const lossDollars = (lossBps / 10000) * usdTier;
        const profit = cardReward - lossDollars;

        // Threshold: the max bps we can lose and still break even
        const thresholdBps = (cardReward / usdTier) * 10000;

        opportunities.push({
          pairLabel: `${mintA.slice(0, 4)}→${mintB.slice(0, 4)}`,
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
        });
      } catch (err) {
        console.error(`Scan error for pair ${mintA.slice(0,4)}/${mintB.slice(0,4)} @ $${usdTier}:`, err);
      }
    }
  }

  // Return only profitable opportunities, sorted by profit desc
  return opportunities
    .filter((o) => o.roundTripLossBps < o.thresholdBps)
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}
```

**Step 2: Commit**

```bash
git add src/scanner.ts
git commit -m "feat: add scanner module"
```

---

### Task 6: Executor Module

**Files:**
- Create: `src/executor.ts`

**Step 1: Write executor.ts**

```typescript
import { execute } from './ultra.js';
import { signTransaction } from './signer.js';
import { Opportunity } from './scanner.js';

export interface ExecutionResult {
  opportunity: Opportunity;
  abSignature?: string;
  baSignature?: string;
  abSuccess: boolean;
  baSuccess: boolean;
  error?: string;
}

export async function executeOpportunity(opp: Opportunity): Promise<ExecutionResult> {
  try {
    // Sign both transactions
    const signedAB = signTransaction(opp.orderAB.transaction);
    const signedBA = signTransaction(opp.orderBA.transaction);

    // Execute both concurrently
    const [resAB, resBA] = await Promise.all([
      execute(signedAB, opp.orderAB.requestId),
      execute(signedBA, opp.orderBA.requestId),
    ]);

    return {
      opportunity: opp,
      abSignature: resAB.signature,
      baSignature: resBA.signature,
      abSuccess: resAB.status === 'Success',
      baSuccess: resBA.status === 'Success',
    };
  } catch (err) {
    return {
      opportunity: opp,
      abSuccess: false,
      baSuccess: false,
      error: String(err),
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/executor.ts
git commit -m "feat: add executor module"
```

---

### Task 7: Logger Module

**Files:**
- Create: `src/logger.ts`

**Step 1: Write logger.ts**

```typescript
import { Opportunity } from './scanner.js';
import { ExecutionResult } from './executor.js';

let totalVolume = 0;
let totalCards = 0;
let totalExecutions = 0;
let totalLoss = 0;

export function logScanResult(opportunities: Opportunity[]) {
  const now = new Date().toISOString();
  if (opportunities.length === 0) {
    console.log(`[${now}] Scan: no profitable opportunities`);
    return;
  }
  for (const o of opportunities) {
    console.log(
      `[${now}] Found: ${o.pairLabel} | loss=${o.roundTripLossBps.toFixed(1)}bps | threshold=${o.thresholdBps.toFixed(1)}bps | est.profit=$${o.estimatedProfit.toFixed(3)}`
    );
  }
}

export function logExecution(result: ExecutionResult) {
  const now = new Date().toISOString();
  const o = result.opportunity;
  totalExecutions++;

  if (result.abSuccess && result.baSuccess) {
    // Rough volume calculation
    const volume = Number(o.orderAB.inAmount) + Number(o.orderBA.inAmount);
    totalVolume += volume;
    const cards = (2 * 1000 / 10000) * o.cardMultiplier; // approximate
    totalCards += cards;
    console.log(
      `[${now}] EXECUTED: ${o.pairLabel} | AB=${result.abSignature?.slice(0,8)} | BA=${result.baSignature?.slice(0,8)} | loss=${o.roundTripLossBps.toFixed(1)}bps`
    );
  } else {
    console.log(
      `[${now}] FAILED: ${o.pairLabel} | AB=${result.abSuccess} BA=${result.baSuccess} | ${result.error || ''}`
    );
  }
}

export function logStats() {
  console.log(`--- Stats: executions=${totalExecutions} | est.cards=${totalCards.toFixed(1)} | est.reward=$${(totalCards * 2.1).toFixed(2)} ---`);
}
```

**Step 2: Commit**

```bash
git add src/logger.ts
git commit -m "feat: add logger module"
```

---

### Task 8: Main Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write index.ts**

```typescript
import { SCAN_INTERVAL_MS } from './config.js';
import { getWallet } from './signer.js';
import { scanOnce } from './scanner.js';
import { executeOpportunity } from './executor.js';
import { logScanResult, logExecution, logStats } from './logger.js';

async function main() {
  const wallet = getWallet();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Scan interval: ${SCAN_INTERVAL_MS}ms`);
  console.log('Starting scanner...\n');

  let cycle = 0;
  while (true) {
    cycle++;
    try {
      const opportunities = await scanOnce();
      logScanResult(opportunities);

      if (opportunities.length > 0) {
        // Execute the best opportunity
        const best = opportunities[0];
        const result = await executeOpportunity(best);
        logExecution(result);
      }

      if (cycle % 10 === 0) logStats();
    } catch (err) {
      console.error('Cycle error:', err);
    }

    await new Promise((r) => setTimeout(r, SCAN_INTERVAL_MS));
  }
}

main().catch(console.error);
```

**Step 2: Add run scripts to package.json**

Add to `scripts`:
```json
{
  "dev": "tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

**Step 3: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: add main entry point"
```

---

### Task 9: Dry-Run Mode

**Files:**
- Modify: `src/config.ts` — add `DRY_RUN` env var
- Modify: `src/index.ts` — skip execute when dry run

**Step 1: Add DRY_RUN to config.ts**

Add to config.ts:
```typescript
export const DRY_RUN = process.env.DRY_RUN !== 'false'; // default true
```

**Step 2: Update index.ts to check DRY_RUN**

In the main loop, before executing:
```typescript
import { DRY_RUN } from './config.js';

// In main():
if (DRY_RUN) {
  console.log(`[DRY RUN] Would execute: ${best.pairLabel} | loss=${best.roundTripLossBps.toFixed(1)}bps`);
} else {
  const result = await executeOpportunity(best);
  logExecution(result);
}
```

**Step 3: Update .env.example**

```
PRIVATE_KEY=your-base58-encoded-private-key
JUP_API_KEY=your-jupiter-api-key
DRY_RUN=true
```

**Step 4: Commit**

```bash
git add src/config.ts src/index.ts .env.example
git commit -m "feat: add dry-run mode (default on)"
```

---

### Task 10: Docker Build & Test

**Step 1: Build and test Docker image**

```bash
cd /home/ramu/pokemoney
docker compose build
```

**Step 2: Test dry run locally first**

```bash
npm run dev
# Verify it scans and logs without errors
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize docker setup"
```
