"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const CONNECTOR_NAMES: Record<string, string> = {
  Injected: "Browser wallet",
  MetaMask: "MetaMask",
  "Coinbase Wallet": "Coinbase Wallet",
  WalletConnect: "WalletConnect",
};

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[120px] truncate rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-white transition hover:bg-zinc-600"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-900 py-2 shadow-xl">
            <p className="px-3 py-1 text-xs font-medium text-zinc-500">Choose wallet</p>
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => {
                  connect({ connector });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition hover:bg-zinc-800"
              >
                <span>{CONNECTOR_NAMES[connector.name] ?? connector.name}</span>
              </button>
            ))}
            {error && <p className="mt-2 px-3 text-xs text-red-400">{error.message}</p>}
          </div>
        </>
      )}
    </div>
  );
}
