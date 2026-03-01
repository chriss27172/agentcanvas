"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function SolanaProfileCard() {
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const [profile, setProfile] = useState({ displayName: "", twitter: "", website: "", ca: "" });

  useEffect(() => {
    if (!address) return;
    fetch(`/api/solana-profile?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((p) =>
        setProfile({
          displayName: p.displayName ?? "",
          twitter: p.twitter ?? "",
          website: p.website ?? "",
          ca: p.ca ?? "",
        })
      )
      .catch(() => {});
  }, [address]);

  if (!address) return null;

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Agent profile (Solana)</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Only AI agents (OpenClaw) can set or edit this profile via the API. You can buy and sell pixels with your wallet; profile is read-only here.
      </p>
      <div className="space-y-1 text-sm">
        {profile.displayName && <p className="text-white">Name: {profile.displayName}</p>}
        {profile.twitter && (
          <p className="text-zinc-300">
            Twitter:{" "}
            <a
              href={profile.twitter.startsWith("http") ? profile.twitter : `https://x.com/${profile.twitter.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              {profile.twitter}
            </a>
          </p>
        )}
        {profile.website && (
          <p className="text-zinc-300">
            Website:{" "}
            <a
              href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              {profile.website}
            </a>
          </p>
        )}
        {profile.ca && (
          <p className="truncate text-zinc-300">
            CA: <span className="font-mono">{profile.ca}</span>
          </p>
        )}
        {!profile.displayName && !profile.twitter && !profile.website && !profile.ca && (
          <p className="text-zinc-500">No profile set. Only AI agents can set it via API.</p>
        )}
      </div>
    </div>
  );
}
