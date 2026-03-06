"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { GRID_SIZE } from "@/config/contracts";

const CHUNK = 10_000;
const MAX_BASE_CHUNKS = 100;

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

  useEffect(() => {
    if (!solanaAddress) {
      setSolanaPixels([]);
      return;
    }
    setLoadingSolana(true);
    fetch(`/api/my-pixels?owner=${encodeURIComponent(solanaAddress)}`)
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
    if (!baseAddress) {
      setBasePixels([]);
      return;
    }
    setLoadingBase(true);
    setBasePixels([]);
    setBaseProgress("0%");
    let cancelled = false;
    const collected: PixelRow[] = [];
    let done = 0;
    const totalChunks = MAX_BASE_CHUNKS;
    (async () => {
      for (let start = 0; start < GRID_SIZE * GRID_SIZE && !cancelled; start += CHUNK) {
        const end = Math.min(start + CHUNK, GRID_SIZE * GRID_SIZE);
        try {
          const res = await fetch(`/api/base-pixels?startId=${start}&endId=${end}`, { cache: "no-store" });
          const json = (await res.json()) as { pixels?: Array<{ id: number; owner: string; price: number; forSale: boolean; exists: boolean }> };
          const list = json.pixels ?? [];
          list.forEach((p) => {
            if (p.owner && p.owner.toLowerCase() === baseAddress.toLowerCase() && p.exists) {
              collected.push({
                id: p.id,
                x: Math.floor(p.id / GRID_SIZE),
                y: p.id % GRID_SIZE,
                listPrice: p.price,
                forSale: p.forSale,
              });
            }
          });
        } catch {
          // skip chunk
        }
        done++;
        if (!cancelled) {
          setBaseProgress(`${Math.round((done / totalChunks) * 100)}%`);
          setBasePixels([...collected]);
        }
        if (done >= totalChunks) break;
      }
      if (!cancelled) {
        setBaseProgress("");
        setLoadingBase(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoadingBase(false);
    };
  }, [baseAddress]);

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
            <h2 className="mb-3 text-lg font-semibold text-white">
              Base {baseAddress && <span className="font-mono text-sm text-zinc-500">({baseAddress.slice(0, 8)}…)</span>}
            </h2>
            {loadingBase ? (
              <p className="text-zinc-500">
                Scanning canvas… {baseProgress && `(${baseProgress})`}
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
            <h2 className="mb-3 text-lg font-semibold text-white">
              Solana {solanaAddress && <span className="font-mono text-sm text-zinc-500">({solanaAddress.slice(0, 8)}…)</span>}
            </h2>
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
