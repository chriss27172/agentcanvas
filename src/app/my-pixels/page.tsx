"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { Header } from "@/components/Header";


interface PixelRow {
  id: number;
  x: number;
  y: number;
  listPrice: number;
  forSale: boolean;
}

export default function MyPixelsPage() {
  const { address: baseAddress } = useAccount();
  const { publicKey: solanaKey } = useWallet();
  const solanaAddress = solanaKey?.toBase58() ?? null;

  const [basePixels, setBasePixels] = useState<PixelRow[]>([]);
  const [solanaPixels, setSolanaPixels] = useState<PixelRow[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingSolana, setLoadingSolana] = useState(false);
  const [baseProgress, setBaseProgress] = useState("");

  const fetchSolanaPixels = useCallback(() => {
    if (!solanaAddress) return;
    setLoadingSolana(true);
    fetch(`/api/my-pixels?owner=${encodeURIComponent(solanaAddress)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.chain === "solana" && Array.isArray(data.pixels)) {
          setSolanaPixels(data.pixels);
        } else {
          setSolanaPixels([]);
        }
      })
      .catch(() => setSolanaPixels([]))
      .finally(() => setLoadingSolana(false));
  }, [solanaAddress]);

  useEffect(() => {
    if (!solanaAddress) {
      setSolanaPixels([]);
      return;
    }
    fetchSolanaPixels();
  }, [solanaAddress, fetchSolanaPixels]);

  const fetchBasePixels = useCallback(() => {
    if (!baseAddress) return;
    setLoadingBase(true);
    setBaseProgress("…");
    fetch(`/api/my-base-pixels?owner=${encodeURIComponent(baseAddress)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.pixels ?? []) as Array<{ id: number; x: number; y: number; price: number; forSale: boolean }>;
        setBasePixels(
          list.map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            listPrice: p.price,
            forSale: p.forSale,
          }))
        );
      })
      .catch(() => setBasePixels([]))
      .finally(() => {
        setBaseProgress("");
        setLoadingBase(false);
      });
  }, [baseAddress]);

  useEffect(() => {
    if (!baseAddress) {
      setBasePixels([]);
      return;
    }
    fetchBasePixels();
  }, [baseAddress, fetchBasePixels]);

  const hasBase = !!baseAddress;
  const hasSolana = !!solanaAddress;
  const totalPixels = basePixels.length + solanaPixels.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-20 pb-16">
        <h1 className="mb-2 text-3xl font-bold text-white">My pixels</h1>
        <p className="mb-6 text-zinc-400">
          Pixels you own on Base or Solana. Connect a wallet to see and manage them. Click &quot;View on canvas&quot; to list or unlist.
        </p>

        {!hasBase && !hasSolana && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 text-center text-zinc-400">
            Connect a Base or Solana wallet to see your pixels.
          </div>
        )}

        {hasBase && (
          <section className="mb-10">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Base {baseAddress && <span className="font-mono text-sm text-zinc-500">({baseAddress.slice(0, 8)}…)</span>}
              </h2>
              <button
                type="button"
                onClick={() => fetchBasePixels()}
                disabled={loadingBase}
                className="rounded bg-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-500 disabled:opacity-50"
              >
                Odśwież
              </button>
            </div>
            {loadingBase ? (
              <p className="text-zinc-500">
                Loading your Base pixels… {baseProgress}
              </p>
            ) : basePixels.length === 0 ? (
              <p className="text-zinc-500">No Base pixels owned by this wallet.</p>
            ) : (
              <ul className="space-y-2">
                {basePixels.slice(0, 200).map((p) => (
                  <li
                    key={`base-${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm"
                  >
                    <span className="text-zinc-300">
                      Pixel ({p.x}, {p.y}) · ID {p.id}
                    </span>
                    <span className={p.forSale ? "text-amber-400" : "text-zinc-500"}>
                      {p.forSale ? `Listed ${(p.listPrice / 1e6).toFixed(2)} USDC` : "Not listed"}
                    </span>
                    <Link
                      href={`/?pixel=${p.id}`}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500"
                    >
                      View on canvas
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {hasBase && basePixels.length > 200 && (
              <p className="mt-2 text-xs text-zinc-500">Showing first 200 of {basePixels.length} Base pixels.</p>
            )}
          </section>
        )}

        {hasSolana && (
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Solana {solanaAddress && <span className="font-mono text-sm text-zinc-500">({solanaAddress.slice(0, 8)}…)</span>}
              </h2>
              <button
                type="button"
                onClick={() => fetchSolanaPixels()}
                disabled={loadingSolana}
                className="rounded bg-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-500 disabled:opacity-50"
              >
                Odśwież
              </button>
            </div>
            {loadingSolana ? (
              <p className="text-zinc-500">Loading…</p>
            ) : solanaPixels.length === 0 ? (
              <p className="text-zinc-500">No Solana pixels owned by this wallet.</p>
            ) : (
              <ul className="space-y-2">
                {solanaPixels.map((p) => (
                  <li
                    key={`solana-${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm"
                  >
                    <span className="text-zinc-300">
                      Pixel ({p.x}, {p.y}) · ID {p.id}
                    </span>
                    <span className={p.forSale ? "text-amber-400" : "text-zinc-500"}>
                      {p.forSale ? `Listed ${(p.listPrice / 1e6).toFixed(2)} USDC` : "Not listed"}
                    </span>
                    <Link
                      href={`/?pixel=${p.id}`}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500"
                    >
                      View on canvas
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {totalPixels > 0 && (
          <p className="mt-6 text-sm text-zinc-500">
            Total: {totalPixels} pixel{totalPixels !== 1 ? "s" : ""}. Use &quot;View on canvas&quot; to open the pixel and list or unlist.
          </p>
        )}

        <p className="mt-8">
          <Link href="/" className="text-emerald-400 hover:underline">
            ← Back to canvas
          </Link>
        </p>
      </main>
    </div>
  );
}
