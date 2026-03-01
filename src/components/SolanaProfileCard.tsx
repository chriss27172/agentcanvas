"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function SolanaProfileCard() {
  const { publicKey, signMessage } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const [profile, setProfile] = useState({ displayName: "", twitter: "", website: "", ca: "" });
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

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

  const handleSaveWithWallet = async () => {
    if (!publicKey || !address || !signMessage) return;
    setStatus("sending");
    try {
      const message = `agentcanvas:profile:${address}`;
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = Buffer.from(sigBytes).toString("base64");
      const res = await fetch("/api/solana-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          displayName: profile.displayName,
          twitter: profile.twitter,
          website: profile.website,
          ca: profile.ca,
          message,
          signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setStatus("done");
      setEditing(false);
    } catch (e) {
      setStatus("error");
      console.error(e);
    }
  };

  if (!address) return null;

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Your Solana profile</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Link your Twitter, website, CA. Shown on pixels you own on Solana. Sign message to save.
      </p>
      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Display name"
            value={profile.displayName}
            onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Twitter URL or handle"
            value={profile.twitter}
            onChange={(e) => setProfile((p) => ({ ...p, twitter: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Website URL"
            value={profile.website}
            onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            placeholder="CA or link"
            value={profile.ca}
            onChange={(e) => setProfile((p) => ({ ...p, ca: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveWithWallet}
              disabled={status === "sending"}
              className="rounded bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {status === "sending" ? "Sign & save…" : "Sign & save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded bg-zinc-600 px-4 py-2 text-sm text-white hover:bg-zinc-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
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
            <p className="text-zinc-500">No profile set yet.</p>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-sm text-violet-400 hover:underline"
          >
            Edit profile
          </button>
        </div>
      )}
    </div>
  );
}
