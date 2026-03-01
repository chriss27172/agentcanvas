"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { AGENT_CANVAS_ADDRESS } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import type { AgentProfile } from "@/lib/types";

const cache = new Map<string, AgentProfile | null>();

function isSolanaAddress(addr: string): boolean {
  return addr.length >= 32 && addr.length <= 44 && !addr.startsWith("0x");
}

export function useAgentProfile(ownerAddress: string | null | undefined) {
  const client = usePublicClient({ chainId: base.id });
  const cacheKey = ownerAddress ? (ownerAddress.startsWith("0x") ? ownerAddress.toLowerCase() : ownerAddress) : "";
  const [profile, setProfile] = useState<AgentProfile | null>(cacheKey ? cache.get(cacheKey) ?? null : null);

  useEffect(() => {
    if (!ownerAddress) {
      setProfile(null);
      return;
    }
    const key = ownerAddress.startsWith("0x") ? ownerAddress.toLowerCase() : ownerAddress;
    if (cache.has(key)) {
      setProfile(cache.get(key) ?? null);
      return;
    }
    if (isSolanaAddress(ownerAddress)) {
      let cancelled = false;
      fetch(`/api/solana-profile?address=${encodeURIComponent(ownerAddress)}`)
        .then((r) => r.json())
        .then((p) => {
          if (cancelled) return;
          const prof: AgentProfile = {
            displayName: p.displayName ?? "",
            twitter: p.twitter ?? "",
            website: p.website ?? "",
            ca: p.ca ?? "",
          };
          cache.set(key, prof);
          setProfile(prof);
        })
        .catch(() => {
          if (!cancelled) {
            cache.set(key, null);
            setProfile(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    if (!client || AGENT_CANVAS_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setProfile(null);
      return;
    }
    if (ownerAddress.length < 40) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    client
      .readContract({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "getProfile",
        args: [ownerAddress as `0x${string}`],
      })
      .then(([a, b, c, d]) => {
        const p = { displayName: a, twitter: b, website: c, ca: d };
        if (!cancelled) {
          cache.set(key, p);
          setProfile(p);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cache.set(key, null);
          setProfile(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerAddress, client]);

  return profile;
}
