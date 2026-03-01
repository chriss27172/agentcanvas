"use client";

import { useState, useRef, useEffect } from "react";
import { useAgentProfile } from "@/hooks/useAgentProfile";
import type { PixelData } from "@/lib/types";
import { GRID_SIZE } from "@/config/contracts";

function colorForOwner(owner: string | null): string {
  if (!owner || owner === "0x0000000000000000000000000000000000000000") return "#27272a";
  let h = 0;
  for (let i = 0; i < owner.length; i++) {
    h = (h << 5) - h + owner.charCodeAt(i);
    h |= 0;
  }
  return `hsl(${Math.abs(h) % 360}, 55%, 42%)`;
}

interface PixelCellProps {
  id: number;
  data: PixelData | null;
  pixelSize: number;
  onClick: () => void;
}

export function PixelCell({ id, data, pixelSize, onClick }: PixelCellProps) {
  const [hover, setHover] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLButtonElement>(null);
  const x = Math.floor(id / GRID_SIZE);
  const y = id % GRID_SIZE;
  const ownerAddr = data?.owner && data.owner !== "0x0000000000000000000000000000000000000000" ? data.owner : null;
  const profile = useAgentProfile(ownerAddr);

  useEffect(() => {
    if (!hover || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [hover]);

  const hasOwner = !!ownerAddr;
  const priceLabel = !data?.exists
    ? "1 USDC to claim"
    : data.forSale
      ? `${(data.price / 1e6).toFixed(2)} USDC`
      : null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="relative border border-zinc-700/50 transition hover:border-emerald-500/80 hover:brightness-110 hover:z-10"
        style={{
          width: pixelSize,
          height: pixelSize,
          backgroundColor: colorForOwner(ownerAddr),
        }}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={`Pixel (${x}, ${y})`}
      />
      {hover && (
        <div
          className="pointer-events-none fixed z-[100] w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 shadow-xl"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
        >
          <div className="mb-1.5 text-xs font-medium text-zinc-400">
            Pixel ({x}, {y})
          </div>
          {hasOwner ? (
            <>
              {profile?.displayName && (
                <div className="text-sm font-medium text-white">{profile.displayName}</div>
              )}
              {profile?.twitter && (
                <div className="truncate text-xs text-zinc-300">
                  @{profile.twitter.replace(/^@/, "").split("/").pop() || profile.twitter}
                </div>
              )}
              {profile?.website && (
                <div className="truncate text-xs text-emerald-400">{profile.website}</div>
              )}
              {!profile?.displayName && !profile?.twitter && (
                <div className="font-mono text-xs text-zinc-400">
                  {ownerAddr.slice(0, 6)}…{ownerAddr.slice(-4)}
                </div>
              )}
              {priceLabel && (
                <div className="mt-1.5 text-xs font-medium text-amber-400">Listed · {priceLabel}</div>
              )}
            </>
          ) : (
            <div className="text-sm text-zinc-400">Unclaimed · 1 USDC to claim</div>
          )}
          <div className="mt-2 text-xs text-emerald-400">Click to buy or sell</div>
        </div>
      )}
    </>
  );
}
