"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { GRID_SIZE } from "@/config/contracts";
import { fetchSolanaPixels, type SolanaPixel } from "@/lib/solana";
import { SolanaPixelModal } from "./SolanaPixelModal";
import { SolanaPixelCell } from "./SolanaPixelCell";

const PIXEL_SIZE = 14;
const VISIBLE = 40;

function clampOffset(o: number): number {
  return Math.max(0, Math.min(GRID_SIZE - VISIBLE, o));
}

export function SolanaPixelGrid() {
  const { connection } = useConnection();
  const [pixels, setPixels] = useState<Map<number, SolanaPixel>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const fetchChunk = useCallback(
    async (startX: number, startY: number, w: number, h: number) => {
      const next = await fetchSolanaPixels(connection, startX, startY, w, h);
      setPixels((prev) => new Map([...prev, ...next]));
    },
    [connection]
  );

  useEffect(() => {
    setLoading(true);
    fetchChunk(offset.x, offset.y, VISIBLE, VISIBLE).finally(() => setLoading(false));
  }, [offset.x, offset.y, fetchChunk]);

  const handleWheel = (e: React.WheelEvent) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.deltaX) setOffset((o) => ({ ...o, x: clampOffset(o.x + (e.deltaX > 0 ? step : -step)) }));
    if (e.deltaY) setOffset((o) => ({ ...o, y: clampOffset(o.y + (e.deltaY > 0 ? step : -step)) }));
  };

  const pixelIds = useMemo(() => {
    const list: number[] = [];
    for (let y = 0; y < VISIBLE; y++)
      for (let x = 0; x < VISIBLE; x++) list.push((offset.y + y) * GRID_SIZE + (offset.x + x));
    return list;
  }, [offset]);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-zinc-500">
        Hover a pixel to see its owner · Click to buy or sell · 1M pixels · 5% fee on resales
      </p>
      <p className="text-center text-sm text-zinc-500">
        Solana · Treasury: 62yk…z1mR · Phantom & other wallets
      </p>
      <div
        className="overflow-auto rounded-xl border border-zinc-700 bg-zinc-900"
        onWheel={handleWheel}
        style={{
          width: VISIBLE * PIXEL_SIZE,
          height: VISIBLE * PIXEL_SIZE,
          maxWidth: "95vw",
          maxHeight: "70vh",
        }}
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-zinc-500">Loading…</div>
        ) : (
          <div
            className="relative grid shrink-0"
            style={{
              gridTemplateColumns: `repeat(${VISIBLE}, ${PIXEL_SIZE}px)`,
              gridTemplateRows: `repeat(${VISIBLE}, ${PIXEL_SIZE}px)`,
            }}
          >
            {pixelIds.map((id) => (
              <SolanaPixelCell
                key={id}
                id={id}
                data={pixels.get(id) ?? null}
                pixelSize={PIXEL_SIZE}
                onClick={() => setSelectedId(id)}
              />
            ))}
          </div>
        )}
      </div>
      {selectedId !== null && (
        <SolanaPixelModal
          pixelId={selectedId}
          data={pixels.get(selectedId) ?? null}
          onClose={() => setSelectedId(null)}
          onUpdate={() => fetchChunk(offset.x, offset.y, VISIBLE, VISIBLE)}
        />
      )}
    </div>
  );
}
