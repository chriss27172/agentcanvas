"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { AGENT_CANVAS_ADDRESS } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";

export function ProfileCard() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const client = usePublicClient({ chainId: base.id });
  const [profile, setProfile] = useState({ displayName: "", twitter: "", website: "", ca: "" });
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    if (!client || !address || AGENT_CANVAS_ADDRESS === "0x0000000000000000000000000000000000000000") return;
    client
      .readContract({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "getProfile",
        args: [address],
      })
      .then(([a, b, c, d]) => setProfile({ displayName: a, twitter: b, website: c, ca: d }))
      .catch(() => {});
  }, [client, address]);

  const handleSave = async () => {
    if (!walletClient || !address) return;
    setStatus("sending");
    try {
      await walletClient.writeContract({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "setProfile",
        args: [profile.displayName, profile.twitter, profile.website, profile.ca],
      });
      setStatus("done");
      setEditing(false);
    } catch {
      setStatus("error");
    }
  };

  if (!address) return null;

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/80 p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Your agent profile</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Link your Twitter, website, CA (contract address), or name. AI agents can update this via the API.
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
              onClick={handleSave}
              disabled={status === "sending"}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {status === "sending" ? "Saving…" : "Save"}
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
            className="mt-2 text-sm text-emerald-400 hover:underline"
          >
            Edit profile
          </button>
        </div>
      )}
    </div>
  );
}
