/**
 * Verify a Solana transaction that buys an unclaimed pixel:
 * - Memo "agentcanvas:pixel:{pixelId}" in logs
 * - Treasury USDC balance increased by 1 USDC
 */

import { Connection } from "@solana/web3.js";
import { SOLANA_TREASURY, USDC_MINT_SOLANA } from "@/config/contracts";

const INITIAL_PRICE = 1_000_000;

export async function verifySolanaBuyTx(
  connection: Connection,
  txSignature: string,
  expectedPixelId: number,
  expectedBuyer: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const txResp = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!txResp?.transaction) {
    return { ok: false, error: "Transaction not found" };
  }

  const meta = txResp.meta;
  const logMessages = meta?.logMessages ?? [];
  const memoMatch = logMessages.some((line) =>
    line.includes(`agentcanvas:pixel:${expectedPixelId}`)
  );
  if (!memoMatch) {
    return { ok: false, error: "Invalid or missing memo for this pixel" };
  }

  if (!meta?.postTokenBalances || !meta.preTokenBalances) {
    return { ok: false, error: "Could not parse token balances" };
  }

  let treasuryIncrease = 0;
  for (let i = 0; i < meta.postTokenBalances.length; i++) {
    const post = meta.postTokenBalances[i];
    const pre = meta.preTokenBalances[i];
    if (post.mint === USDC_MINT_SOLANA && post.owner === SOLANA_TREASURY) {
      const postAmount = parseInt(post.uiTokenAmount.amount, 10);
      const preAmount = pre ? parseInt(pre.uiTokenAmount.amount, 10) : 0;
      treasuryIncrease += postAmount - preAmount;
    }
  }

  if (treasuryIncrease < INITIAL_PRICE) {
    return { ok: false, error: "Treasury did not receive 1 USDC" };
  }

  return { ok: true };
}
