"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { GRID_SIZE } from "@/config/contracts";
import {
  createBuyInstruction,
  createListPixelInstruction,
  createUnlistPixelInstruction,
  getUsdcAta,
  type SolanaPixel,
} from "@/lib/solana";

interface SolanaPixelModalProps {
  pixelId: number;
  data: SolanaPixel | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function SolanaPixelModal({ pixelId, data, onClose, onUpdate }: SolanaPixelModalProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [listPrice, setListPrice] = useState("1");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const x = Math.floor(pixelId / GRID_SIZE);
  const y = pixelId % GRID_SIZE;
  const owner = wallet.publicKey?.toBase58();
  const isOwn = owner && data?.owner === owner;
  const canBuy = data?.exists ? data?.forSale : true;
  const priceToPay = data?.exists && data?.forSale ? data.price : 1_000_000;

  const handleBuy = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const sellerUsdc =
        data?.exists && data?.forSale && data.owner
          ? getUsdcAta(new PublicKey(data.owner))
          : undefined;
      const ix = createBuyInstruction(wallet.publicKey, pixelId, sellerUsdc);
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const handleList = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    const priceWei = Math.round(parseFloat(listPrice) * 1_000_000);
    if (priceWei <= 0) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const ix = createListPixelInstruction(wallet.publicKey, pixelId, priceWei);
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const handleUnlist = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const ix = createUnlistPixelInstruction(wallet.publicKey, pixelId);
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Pixel ({x}, {y}) · Solana
          </h2>
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {data && (
          <div className="mb-4 space-y-1 text-sm text-zinc-400">
            <p>Owner: {data.owner.slice(0, 8)}…{data.owner.slice(-6)}</p>
            {data.forSale && <p>Price: {(data.price / 1_000_000).toFixed(2)} USDC</p>}
            {!data.exists && <p>Unclaimed — 1 USDC to buy</p>}
          </div>
        )}
        {errorMsg && <p className="mb-2 text-sm text-red-400">{errorMsg}</p>}
        <div className="flex flex-col gap-2">
          {canBuy && !isOwn && (
            <button
              type="button"
              disabled={status === "sending" || !wallet.publicKey}
              onClick={handleBuy}
              className="rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : `Buy for ${data?.exists && data?.forSale ? (data.price / 1_000_000).toFixed(2) : "1"} USDC`}
            </button>
          )}
          {isOwn && (
            <>
              {data?.forSale ? (
                <button
                  type="button"
                  disabled={status === "sending"}
                  onClick={handleUnlist}
                  className="rounded bg-zinc-600 py-2 text-sm text-white hover:bg-zinc-500 disabled:opacity-50"
                >
                  Unlist pixel
                </button>
              ) : (
                <>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white"
                    placeholder="Price in USDC"
                  />
                  <button
                    type="button"
                    disabled={status === "sending"}
                    onClick={handleList}
                    className="rounded bg-amber-600 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    List for sale
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {status === "done" && <p className="mt-3 text-sm text-emerald-400">Success. You can close this.</p>}
      </div>
    </div>
  );
}
