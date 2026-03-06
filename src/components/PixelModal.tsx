"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { parseUnits } from "viem";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AGENT_CANVAS_ADDRESS, USDC_BASE, GRID_SIZE, TREASURY } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getUsdcAta } from "@/lib/solana";
import { buildBuyPixelTx, buildBuyListedPixelTx } from "@/lib/solana-buy-tx";
import type { PixelData } from "@/lib/types";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface PixelModalProps {
  pixelId: number;
  data: PixelData | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function PixelModal({ pixelId, data, onClose, onUpdate }: PixelModalProps) {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { connection } = useConnection();
  const solanaWallet = useWallet();
  const [listPrice, setListPrice] = useState("1");
  const [status, setStatus] = useState<"idle" | "approving" | "buying" | "buying_solana" | "buying_listed_solana" | "listing" | "unlisting" | "listing_solana" | "unlisting_solana" | "switching" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const ZERO = "0x0000000000000000000000000000000000000000";
  const baseContractSet = AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== ZERO;
  const isOnBase = chain?.id === base.id;
  const x = Math.floor(pixelId / GRID_SIZE);
  const y = pixelId % GRID_SIZE;
  const isOwnBase = address && data?.owner?.toLowerCase() === address.toLowerCase();
  const isOwnSolana = data?.chain === "solana" && solanaWallet?.publicKey?.toBase58() === data?.owner;
  const isOwn = isOwnBase || isOwnSolana;
  const canBuyBase = baseContractSet && data?.chain !== "solana" && (data?.exists ? data?.forSale : true);
  const canBuySolana = !data?.exists || (data?.chain === "solana" && data?.forSale);
  const priceToPay = data?.exists && data?.forSale ? data.price : 1e6;
  const isListedSolana = data?.chain === "solana" && data?.forSale && !isOwn;

  const ensureApproval = async (): Promise<boolean> => {
    if (!address || !publicClient) return false;
    const amount = BigInt(priceToPay);
    const current = (await publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, AGENT_CANVAS_ADDRESS],
    })) as bigint;
    if (current >= amount) return true;
    await writeContractAsync({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [AGENT_CANVAS_ADDRESS, BigInt(Number.MAX_SAFE_INTEGER)],
      chainId: base.id,
    });
    return true;
  };

  const handleBuyWithSolana = async () => {
    if (!solanaWallet.publicKey || !canBuySolana) return;
    setStatus("buying_solana");
    setErrorMsg("");
    try {
      const buyerUsdcAta = getUsdcAta(solanaWallet.publicKey);
      const tx = buildBuyPixelTx(solanaWallet.publicKey, buyerUsdcAta, pixelId);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = solanaWallet.publicKey;
      const sig = await solanaWallet.sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
      const res = await fetch("/api/buy-solana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          txSignature: sig,
          buyer: solanaWallet.publicKey.toBase58(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to register purchase");
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const handleBuy = async () => {
    if (!address || !canBuyBase) return;
    if (!isOnBase && switchChainAsync) {
      setStatus("switching");
      setErrorMsg("");
      try {
        await switchChainAsync({ chainId: base.id });
        setStatus("idle");
        setErrorMsg("Switched to Base. Click Buy again.");
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Switch to Base in your wallet first.");
      }
      return;
    }
    setStatus("approving");
    setErrorMsg("");
    try {
      const ok = await ensureApproval();
      if (!ok) {
        setStatus("error");
        setErrorMsg("Approval failed");
        return;
      }
      setStatus("buying");
      await writeContractAsync({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "buy",
        args: [BigInt(pixelId)],
        chainId: base.id,
      });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("black hole") || msg.includes("restricted") || msg.includes("0x0")) {
        setErrorMsg("USDC blocks transfers to address 0x0. The Base contract was deployed with treasury = 0x0. You must redeploy the contract with treasury = your wallet (e.g. 0xf56e55e35d2cca5a34f5ba568454974424aea0f4). See DEPLOY.md in the repo.");
      } else {
        setErrorMsg(msg || "Transaction failed");
      }
    }
  };

  const handleList = async () => {
    if (!address || !isOwnBase) return;
    if (!isOnBase && switchChainAsync) {
      setStatus("switching");
      setErrorMsg("");
      try {
        await switchChainAsync({ chainId: base.id });
        setStatus("idle");
        setErrorMsg("Switched to Base. Click List again.");
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Switch to Base in your wallet first.");
      }
      return;
    }
    const priceWei = parseUnits(listPrice, 6);
    if (priceWei <= BigInt(0)) return;
    setStatus("listing");
    setErrorMsg("");
    try {
      await writeContractAsync({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "list",
        args: [BigInt(pixelId), priceWei],
        chainId: base.id,
      });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const handleUnlist = async () => {
    if (!address || !isOwnBase) return;
    if (!isOnBase && switchChainAsync) {
      setStatus("switching");
      setErrorMsg("");
      try {
        await switchChainAsync({ chainId: base.id });
        setStatus("idle");
        setErrorMsg("Switched to Base. Click Unlist again.");
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Switch to Base in your wallet first.");
      }
      return;
    }
    setStatus("unlisting");
    setErrorMsg("");
    try {
      await writeContractAsync({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "unlist",
        args: [BigInt(pixelId)],
        chainId: base.id,
      });
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const handleListSolana = async () => {
    if (!solanaWallet.publicKey || !isOwnSolana) return;
    const priceStr = listPrice.trim() || "1";
    if (parseFloat(priceStr) < 0.01) {
      setErrorMsg("Min price 0.01 USDC");
      return;
    }
    setStatus("listing_solana");
    setErrorMsg("");
    try {
      const message = `agentcanvas:list:${pixelId}:${priceStr}`;
      const msgBytes = new TextEncoder().encode(message);
      const sig = await solanaWallet.signMessage?.(msgBytes);
      if (!sig) throw new Error("Signing failed");
      const signature = Buffer.from(sig).toString("base64");
      const res = await fetch("/api/list-solana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          listPriceUsdc: priceStr,
          owner: solanaWallet.publicKey.toBase58(),
          message,
          signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to list");
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleUnlistSolana = async () => {
    if (!solanaWallet.publicKey || !isOwnSolana) return;
    setStatus("unlisting_solana");
    setErrorMsg("");
    try {
      const message = `agentcanvas:unlist:${pixelId}`;
      const msgBytes = new TextEncoder().encode(message);
      const sig = await solanaWallet.signMessage?.(msgBytes);
      if (!sig) throw new Error("Signing failed");
      const signature = Buffer.from(sig).toString("base64");
      const res = await fetch("/api/unlist-solana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          owner: solanaWallet.publicKey.toBase58(),
          message,
          signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to unlist");
      setStatus("done");
      onUpdate();
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleBuyListedSolana = async () => {
    if (!solanaWallet.publicKey || !data || data.chain !== "solana" || !data.forSale || !data.owner) return;
    const listPrice = data.price;
    if (listPrice <= 0) return;
    setStatus("buying_listed_solana");
    setErrorMsg("");
    try {
      const buyerUsdcAta = getUsdcAta(solanaWallet.publicKey);
      const sellerPubkey = new PublicKey(data.owner);
      const sellerUsdcAta = getUsdcAta(sellerPubkey);
      const tx = buildBuyListedPixelTx(
        solanaWallet.publicKey,
        buyerUsdcAta,
        sellerPubkey,
        sellerUsdcAta,
        pixelId,
        listPrice
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = solanaWallet.publicKey;
      const sig = await solanaWallet.sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
      const res = await fetch("/api/buy-listed-solana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          txSignature: sig,
          buyer: solanaWallet.publicKey.toBase58(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to register purchase");
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
          <h2 className="text-lg font-semibold text-white">Pixel ({x}, {y})</h2>
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
            <p>Owner: {data.owner.slice(0, 10)}…{data.owner.slice(-8)}{data.chain === "solana" ? " (Solana)" : ""}</p>
            {data.forSale && <p>Price: {(data.price / 1e6).toFixed(2)} USDC</p>}
            {!data.exists && <p>Unclaimed — 1 USDC to buy (Base or Solana)</p>}
            {!data.exists && (
              <p className="text-xs text-zinc-500">Payment: 1 USDC → project wallet (Base or Solana). You become the owner.</p>
            )}
            {data.exists && data.forSale && data.chain !== "solana" && (
              <p className="text-xs text-zinc-500">Payment: 95% to seller, 5% fee to project wallet.</p>
            )}
            {data?.chain !== "solana" && !baseContractSet && (
              <p className="text-amber-400">Base contract not configured. Set NEXT_PUBLIC_AGENT_CANVAS_ADDRESS (deploy with treasury = 0xf56e55e3…a0f4).</p>
            )}
          </div>
        )}
        {errorMsg && <p className="mb-2 text-sm text-red-400">{errorMsg}</p>}
        <div className="flex flex-col gap-2">
          {canBuyBase && !isOwn && (
            <button
              type="button"
              disabled={status === "approving" || status === "buying" || status === "switching"}
              onClick={handleBuy}
              className="rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {status === "switching"
                ? "Switching to Base…"
                : status === "approving"
                  ? "Approve USDC…"
                  : status === "buying"
                    ? "Buying…"
                    : !isOnBase && address
                      ? "Switch to Base & buy"
                      : `Buy with Base — ${data?.exists && data?.forSale ? (data.price / 1e6).toFixed(2) : "1"} USDC`}
            </button>
          )}
          {canBuySolana && !isOwn && !isListedSolana && (
            <button
              type="button"
              disabled={status === "buying_solana" || !solanaWallet.publicKey}
              onClick={handleBuyWithSolana}
              className="rounded bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {status === "buying_solana" ? "Sending…" : "Buy with Solana — 1 USDC"}
            </button>
          )}
          {isListedSolana && (
            <button
              type="button"
              disabled={status === "buying_listed_solana" || !solanaWallet.publicKey}
              onClick={handleBuyListedSolana}
              className="rounded bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {status === "buying_listed_solana" ? "Sending…" : `Buy with Solana — ${((data?.price ?? 0) / 1e6).toFixed(2)} USDC`}
            </button>
          )}
          {isOwn && data?.chain === "solana" && (
            <>
              {data?.forSale ? (
                <button
                  type="button"
                  disabled={status === "unlisting_solana"}
                  onClick={handleUnlistSolana}
                  className="rounded bg-zinc-600 py-2 text-sm text-white hover:bg-zinc-500 disabled:opacity-50"
                >
                  Unlist pixel
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    min="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white"
                    placeholder="Price in USDC (e.g. 1.5)"
                  />
                  <button
                    type="button"
                    disabled={status === "listing_solana"}
                    onClick={handleListSolana}
                    className="rounded bg-amber-600 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    List for sale
                  </button>
                </>
              )}
            </>
          )}
          {isOwn && data?.chain !== "solana" && (
            <>
              {data?.forSale ? (
                <button
                  type="button"
                  disabled={status === "unlisting"}
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
                    disabled={status === "listing"}
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
        {status === "done" && (
          <p className="mt-3 text-sm text-emerald-400">Success. You can close this.</p>
        )}
      </div>
    </div>
  );
}
