"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ListedPixel {
  id: number;
  price: number;
  owner: string;
  chain: "base" | "solana";
}

const PAGE_SIZE = 20;

export function ListedPixels() {
  const [listed, setListed] = useState<ListedPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/listed-pixels", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setListed(data.listed ?? []);
      })
      .catch(() => {
        if (!cancelled) setListed([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const slice = listed.slice(start, start + PAGE_SIZE);

  return (
    <section id="market" className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Market — listed pixels</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Pixels currently for sale (Base and Solana). Click to open on canvas and buy.
      </p>
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : listed.length === 0 ? (
        <p className="text-zinc-500">No pixels listed for sale yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-3 font-medium">Pixel</th>
                  <th className="pb-2 pr-3 font-medium">Price (USDC)</th>
                  <th className="pb-2 pr-3 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Chain</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => (
                  <tr key={`${p.chain}-${p.id}`} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/?pixel=${p.id}`}
                        className="font-mono text-emerald-400 hover:underline"
                      >
                        #{p.id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-medium text-amber-400">
                      {(p.price / 1e6).toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-zinc-400 truncate max-w-[120px]">
                      {p.owner.slice(0, 6)}…{p.owner.slice(-4)}
                    </td>
                    <td className="py-2">
                      <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-400">
                        {p.chain}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded bg-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="text-zinc-500">
                Page {page} of {totalPages} ({listed.length} listed)
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded bg-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-600 disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
