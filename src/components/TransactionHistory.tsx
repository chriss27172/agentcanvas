"use client";

import { useEffect, useState } from "react";

const PAGE_SIZE = 20;

interface TxRow {
  chain: "base" | "solana";
  type: "buy" | "list" | "unlist" | "buy_listed";
  pixelId: number;
  from?: string;
  to?: string;
  price?: number;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
}

function formatAddr(addr: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatPrice(price?: number) {
  if (price == null) return "—";
  return `${(price / 1e6).toFixed(2)} USDC`;
}

function formatDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function typeLabel(type: TxRow["type"]) {
  switch (type) {
    case "buy": return "Buy";
    case "list": return "List";
    case "unlist": return "Unlist";
    case "buy_listed": return "Buy (listed)";
    default: return type;
  }
}

export function TransactionHistory() {
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/transactions?page=${page}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTxs(data.transactions ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        if (!cancelled) setTxs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section id="transactions" className="w-full max-w-3xl rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Transaction history</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Recent buys, lists and unlists on Base and Solana. Sorted by time.
      </p>
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : txs.length === 0 ? (
        <p className="text-zinc-500">No transactions yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500">
                  <th className="pb-2 pr-2">Time</th>
                  <th className="pb-2 pr-2">Chain</th>
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2 pr-2">Pixel</th>
                  <th className="pb-2 pr-2">From / To</th>
                  <th className="pb-2 pr-2">Price</th>
                  <th className="pb-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx, i) => (
                  <tr key={`${tx.chain}-${tx.txHash ?? tx.timestamp}-${i}`} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-2 text-zinc-400 whitespace-nowrap">{formatDate(tx.timestamp)}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-400">{tx.chain}</span>
                    </td>
                    <td className="py-2 pr-2 text-zinc-300">{typeLabel(tx.type)}</td>
                    <td className="py-2 pr-2 font-mono text-zinc-400">{tx.pixelId}</td>
                    <td className="py-2 pr-2 text-zinc-400">
                      {tx.from && formatAddr(tx.from)}
                      {(tx.from || tx.to) && " → "}
                      {tx.to && formatAddr(tx.to)}
                    </td>
                    <td className="py-2 pr-2 text-emerald-400/90">{formatPrice(tx.price)}</td>
                    <td className="py-2">
                      {tx.txHash && (
                        <a
                          href={tx.chain === "base"
                            ? `https://basescan.org/tx/${tx.txHash}`
                            : `https://solscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:underline truncate max-w-[80px] inline-block"
                        >
                          {tx.txHash.slice(0, 8)}…
                        </a>
                      )}
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
