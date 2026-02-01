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
    const signedAB = signTransaction(opp.orderAB.transaction);
    const signedBA = signTransaction(opp.orderBA.transaction);

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
