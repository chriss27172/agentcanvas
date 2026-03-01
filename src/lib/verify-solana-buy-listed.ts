/**
 * Verify a Solana transaction that buys a listed pixel:
 * - Memo "agentcanvas:buy-listed:{pixelId}" in logs
 * - Seller (owner) received listPrice * 0.95 USDC, treasury received listPrice * 0.05
 */
import { Connection } from "@solana/web3.js";
import { SOLANA_TREASURY, USDC_MINT_SOLANA } from "@/config/contracts";

const FEE_PERCENT = 5;

export async function verifySolanaBuyListedTx(
  connection: Connection,
  txSignature: string,
  expectedPixelId: number,
  expectedBuyer: string,
  expectedSeller: string,
  expectedListPrice: number
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
    line.includes(`agentcanvas:buy-listed:${expectedPixelId}`)
  );
  if (!memoMatch) {
    return { ok: false, error: "Invalid or missing memo for this pixel" };
  }

  if (!meta?.postTokenBalances || !meta.preTokenBalances) {
    return { ok: false, error: "Could not parse token balances" };
  }

  const feeAmount = Math.floor(expectedListPrice * (FEE_PERCENT / 100));
  const sellerAmount = expectedListPrice - feeAmount;

  let treasuryIncrease = 0;
  let sellerIncrease = 0;
  let buyerDecrease = 0;

  const preByOwner = new Map<string, number>();
  for (const b of meta.preTokenBalances) {
    if (b.mint !== USDC_MINT_SOLANA || !b.owner) continue;
    preByOwner.set(b.owner, parseInt(b.uiTokenAmount.amount, 10));
  }
  for (const post of meta.postTokenBalances) {
    if (post.mint !== USDC_MINT_SOLANA || !post.owner) continue;
    const postAmount = parseInt(post.uiTokenAmount.amount, 10);
    const preAmount = preByOwner.get(post.owner) ?? 0;
    const delta = postAmount - preAmount;
    if (post.owner === SOLANA_TREASURY) treasuryIncrease += delta;
    else if (post.owner === expectedSeller) sellerIncrease += delta;
    else if (post.owner === expectedBuyer) buyerDecrease += delta;
  }

  if (treasuryIncrease < feeAmount) {
    return { ok: false, error: "Treasury did not receive the fee" };
  }
  if (sellerIncrease < sellerAmount) {
    return { ok: false, error: "Seller did not receive the sale amount" };
  }
  if (buyerDecrease > -expectedListPrice) {
    return { ok: false, error: "Buyer did not pay the full price" };
  }

  return { ok: true };
}
