"use client";

import { useChain } from "@/context/ChainContext";
import { PixelGrid } from "./PixelGrid";
import { SolanaPixelGrid } from "./SolanaPixelGrid";

export function CanvasByChain() {
  const { chain } = useChain();
  return chain === "solana" ? <SolanaPixelGrid /> : <PixelGrid />;
}
