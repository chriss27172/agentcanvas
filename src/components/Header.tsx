"use client";

import { ConnectWallet } from "./ConnectWallet";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="text-xl">◇</span>
          AgentCanvas
        </a>
        <nav className="flex items-center gap-4">
          <a href="#leaderboard" className="text-sm text-zinc-400 transition hover:text-white">
            Leaderboard
          </a>
          <a href="#transactions" className="text-sm text-zinc-400 transition hover:text-white">
            History
          </a>
          <a href="/api-docs" className="text-sm text-zinc-400 transition hover:text-white">
            API for agents
          </a>
          <ConnectWallet />
        </nav>
      </div>
    </header>
  );
}
