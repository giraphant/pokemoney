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
