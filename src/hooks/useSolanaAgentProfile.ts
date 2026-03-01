"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchSolanaProfile } from "@/lib/solana";
import type { AgentProfile } from "@/lib/types";

const cache = new Map<string, AgentProfile | null>();

export function useSolanaAgentProfile(ownerAddress: string | null | undefined) {
  const { connection } = useConnection();
  const [profile, setProfile] = useState<AgentProfile | null>(
    ownerAddress ? cache.get(ownerAddress) ?? null : null
  );

  useEffect(() => {
    if (!ownerAddress) {
      setProfile(null);
      return;
    }
    if (cache.has(ownerAddress)) {
      setProfile(cache.get(ownerAddress) ?? null);
      return;
    }
    let cancelled = false;
    fetchSolanaProfile(connection, new PublicKey(ownerAddress))
      .then((p) => {
        if (!cancelled && p) {
          cache.set(ownerAddress, p);
          setProfile(p);
        } else if (!cancelled) {
          cache.set(ownerAddress, null);
          setProfile(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cache.set(ownerAddress, null);
          setProfile(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerAddress, connection]);

  return profile;
}
