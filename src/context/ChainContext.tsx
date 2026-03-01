"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ChainType = "base" | "solana";

const ChainContext = createContext<{
  chain: ChainType;
  setChain: (c: ChainType) => void;
} | null>(null);

export function ChainProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<ChainType>("base");
  const value = { chain, setChain: useCallback((c: ChainType) => setChain(c), []) };
  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain() {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error("useChain must be used within ChainProvider");
  return ctx;
}
