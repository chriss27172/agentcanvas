"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AGENT_CANVAS_ADDRESS, USDC_BASE, GRID_SIZE } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getUsdcAta } from "@/lib/solana";
import { buildBuyPixelTx } from "@/lib/solana-buy-tx";
import type { PixelData } from "@/lib/types";

const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

interface BulkBuyModalProps {
  pixelIds: number[];
  pixelData: Map<number, PixelData>;
  onClose: () => void;
  onUpdate: () => void;
}

export function BulkBuyModal({ pixelIds, pixelData, onClose, onUpdate }: BulkBuyModalProps) {
  const { address: baseAddress, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { connection } = useConnection();
  const solanaWallet = useWallet();

  const [step, setStep] = useState<"idle" | "switching" | "approving" | "buying" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const baseIds = pixelIds.filter((id) => {
    const p = pixelData.get(id);
    return !p?.chain || p.chain !== "solana";
  });
  const solanaIds = pixelIds.filter((id) => pixelData.get(id)?.chain === "solana");
  const total = baseIds.length + solanaIds.length;
  const isOnBase = chain?.id === base.id;

  const runBaseBuys = async (): Promise<"switched" | "ok" | "skip"> => {
    if (!baseAddress || !publicClient || baseIds.length === 0) return "skip";
    if (!isOnBase && switchChainAsync) {
      setStep("switching");
      setErrorMsg("");
      try {
        await switchChainAsync({ chainId: base.id });
        setStep("idle");
        setErrorMsg("Switched to Base. Click Buy all again.");
      } catch (e: unknown) {
        setStep("error");
        setErrorMsg(e instanceof Error ? e.message : "Switch to Base in your wallet first.");
      }
      return "switched";
    }
    const totalUsdc = BigInt(baseIds.length) * BigInt(1e6);
    const current = (await publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [baseAddress, AGENT_CANVAS_ADDRESS],
    })) as bigint;
    if (current < totalUsdc) {
      setStep("approving");
      await writeContractAsync({
        address: USDC_BASE,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AGENT_CANVAS_ADDRESS, BigInt(Number.MAX_SAFE_INTEGER)],
        chainId: base.id,
      });
    }
    setStep("buying");
    let done = 0;
    for (const id of baseIds) {
      try {
        await writeContractAsync({
          address: AGENT_CANVAS_ADDRESS,
          abi: AgentCanvasABI,
          functionName: "buy",
          args: [BigInt(id)],
          chainId: base.id,
        });
      } catch (e) {
        setStep("error");
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("black hole") || msg.includes("restricted") || msg.includes("0x0")) {
          setErrorMsg("USDC blocks transfers to 0x0. Redeploy Base contract with treasury = your wallet (see DEPLOY.md).");
        } else {
          setErrorMsg(msg || "Buy failed");
        }
        return;
      }
      done++;
      setProgress(done);
    }
    return "ok";
  };

  const runSolanaBuys = async () => {
    if (!solanaWallet.publicKey || solanaIds.length === 0) return;
    setStep("buying");
    const start = baseIds.length;
    let done = 0;
    for (const id of solanaIds) {
      try {
        const buyerUsdcAta = getUsdcAta(solanaWallet.publicKey);
        const tx = buildBuyPixelTx(solanaWallet.publicKey, buyerUsdcAta, id);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = solanaWallet.publicKey;
        const sig = await solanaWallet.sendTransaction(tx, connection, { skipPreflight: false });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
        const res = await fetch("/api/buy-solana", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pixelId: id, txSignature: sig, buyer: solanaWallet.publicKey.toBase58() }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "API failed");
      } catch (e) {
        setStep("error");
        setErrorMsg(e instanceof Error ? e.message : "Buy failed");
        return;
      }
      done++;
      setProgress(start + done);
    }
  };

  const handleStart = async () => {
    setErrorMsg("");
    setProgress(0);
    try {
      const baseResult = await runBaseBuys();
      if (baseResult === "switched") return;
      await runSolanaBuys();
      setStep("done");
      onUpdate();
      setTimeout(() => onUpdate(), 3000);
    } catch (e) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const canStart = (baseIds.length > 0 && baseAddress) || (solanaIds.length > 0 && solanaWallet.publicKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold text-white">Buy multiple pixels</h2>
        <p className="mb-4 text-sm text-zinc-400">
          {baseIds.length > 0 && `${baseIds.length} on Base (1 USDC each). `}
          {solanaIds.length > 0 && `${solanaIds.length} on Solana (1 USDC each). `}
          Total: {total} pixels.
        </p>
        {step === "idle" && (
          <>
            {!canStart && (
              <p className="mb-3 text-sm text-amber-400">Connect a Base or Solana wallet to buy.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Buy all ({total})
              </button>
              <button type="button" onClick={onClose} className="rounded bg-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-500">
                Cancel
              </button>
            </div>
          </>
        )}
        {(step === "switching" || step === "approving" || step === "buying") && (
          <p className="text-sm text-zinc-300">
            {step === "switching" ? "Switching to Base…" : step === "approving" ? "Approving USDC…" : `Buying… ${progress}/${total}`}
          </p>
        )}
        {step === "done" && (
          <>
            <p className="mb-3 text-sm text-emerald-400">Bought {total} pixels.</p>
            <button type="button" onClick={onClose} className="rounded bg-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-500">
              Close
            </button>
          </>
        )}
        {step === "error" && (
          <>
            <p className="mb-3 text-sm text-red-400">{errorMsg}</p>
            <button type="button" onClick={onClose} className="rounded bg-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-500">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
