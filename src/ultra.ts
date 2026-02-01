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
