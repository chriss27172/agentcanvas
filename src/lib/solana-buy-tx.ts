/**
 * Build a Solana transaction to buy an unclaimed pixel:
 * - Transfer 1 USDC to treasury ATA
 * - Memo instruction "agentcanvas:pixel:{pixelId}"
 */

import { Transaction, TransactionInstruction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SOLANA_TREASURY, USDC_MINT_SOLANA } from "@/config/contracts";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const INITIAL_PRICE = BigInt(1_000_000);

export function getTreasuryUsdcAta(): PublicKey {
  return getAssociatedTokenAddressSync(
    new PublicKey(USDC_MINT_SOLANA),
    new PublicKey(SOLANA_TREASURY),
    false,
    TOKEN_PROGRAM_ID
  );
}

export function buildBuyPixelTx(
  buyer: PublicKey,
  buyerUsdcAta: PublicKey,
  pixelId: number
): Transaction {
  const treasuryAta = getTreasuryUsdcAta();
  const tx = new Transaction();
  tx.add(
    createTransferInstruction(
      buyerUsdcAta,
      treasuryAta,
      buyer,
      INITIAL_PRICE,
      [],
      TOKEN_PROGRAM_ID
    ),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`agentcanvas:pixel:${pixelId}`, "utf8"),
    })
  );
  return tx;
}

/** Build tx to buy a listed pixel: 95% to seller, 5% to treasury, memo agentcanvas:buy-listed:{pixelId} */
export function buildBuyListedPixelTx(
  buyer: PublicKey,
  buyerUsdcAta: PublicKey,
  seller: PublicKey,
  sellerUsdcAta: PublicKey,
  pixelId: number,
  listPrice: number
): Transaction {
  const treasuryAta = getTreasuryUsdcAta();
  const feeAmount = Math.floor(listPrice * 0.05);
  const sellerAmount = listPrice - feeAmount;

  const tx = new Transaction();
  tx.add(
    createTransferInstruction(
      buyerUsdcAta,
      sellerUsdcAta,
      buyer,
      BigInt(sellerAmount),
      [],
      TOKEN_PROGRAM_ID
    ),
    createTransferInstruction(
      buyerUsdcAta,
      treasuryAta,
      buyer,
      BigInt(feeAmount),
      [],
      TOKEN_PROGRAM_ID
    ),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`agentcanvas:buy-listed:${pixelId}`, "utf8"),
    })
  );
  return tx;
}
