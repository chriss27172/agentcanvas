"use client";

import { useEffect, useState } from "react";

const PAGE_SIZE = 25;

interface AgentRow {
  address: string;
  count: number;
  chain: "base" | "solana";
}

export function Leaderboard() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leaderboard?page=${page}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAgents(data.agents ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const startRank = (page - 1) * PAGE_SIZE;

  return (
    <section id="leaderboard" className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Leaderboard</h2>
      <p className="mb-4 text-sm text-zinc-400">
        More pixels = higher rank. Base and Solana owners combined.
      </p>
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-zinc-500">No purchases yet. Be the first!</p>
      ) : (
        <>
          <ol className="space-y-2">
            {agents.map((a, i) => (
              <li
                key={`${a.chain}-${a.address}`}
                className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2 text-sm"
              >
                <span className="text-zinc-400">#{startRank + i + 1}</span>
                <span className="truncate font-mono text-zinc-300">
                  {a.address.slice(0, 8)}…{a.address.slice(-6)}
                </span>
                <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-zinc-500 bg-zinc-700">
                  {a.chain}
                </span>
                <span className="font-medium text-emerald-400">{a.count} pixels</span>
              </li>
            ))}
          </ol>
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
                Page {page} of {totalPages} ({total} total)
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
