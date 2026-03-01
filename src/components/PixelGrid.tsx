"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { AGENT_CANVAS_ADDRESS, GRID_SIZE } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { PixelModal } from "./PixelModal";
import { PixelCell } from "./PixelCell";
import type { PixelData } from "@/lib/types";

const PIXEL_SIZE = 16;
const VISIBLE = 40;
const BATCH = 80;

function clampOffset(o: number): number {
  return Math.max(0, Math.min(GRID_SIZE - VISIBLE, o));
}

export function PixelGrid() {
  const client = usePublicClient({ chainId: base.id });
  const [pixels, setPixels] = useState<Map<number, PixelData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const fetchChunk = useCallback(
    async (startX: number, startY: number, w: number, h: number) => {
      const ids: number[] = [];
      for (let y = startY; y < startY + h && y < GRID_SIZE; y++) {
        for (let x = startX; x < startX + w && x < GRID_SIZE; x++) {
          ids.push(x * GRID_SIZE + y);
        }
      }
      const minId = ids[0] ?? 0;
      const maxId = ids[ids.length - 1] ?? 0;

      let baseResults: Array<{ id: number; x: number; y: number; owner: string; price: number; forSale: boolean; exists: boolean }> = [];
      if (client && AGENT_CANVAS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const batches: number[][] = [];
        for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
        for (const batch of batches) {
          const part = await Promise.all(
            batch.map(async (id) => {
              const x = Math.floor(id / GRID_SIZE);
              const y = id % GRID_SIZE;
              try {
                const [owner, price, forSale, exists] = await client.readContract({
                  address: AGENT_CANVAS_ADDRESS,
                  abi: AgentCanvasABI,
                  functionName: "getPixel",
                  args: [BigInt(id)],
                });
                return { id, x, y, owner: owner as string, price: Number(price), forSale: forSale as boolean, exists: exists as boolean };
              } catch {
                return { id, x, y, owner: "0x0000000000000000000000000000000000000000", price: 0, forSale: false, exists: false };
              }
            })
          );
          baseResults = baseResults.concat(part);
        }
      } else {
        baseResults = ids.map((id) => ({
          id,
          x: Math.floor(id / GRID_SIZE),
          y: id % GRID_SIZE,
          owner: "0x0000000000000000000000000000000000000000",
          price: 0,
          forSale: false,
          exists: false,
        }));
      }

      const solanaRes = await fetch(`/api/solana-pixels?startId=${minId}&endId=${maxId + 1}`);
      const { pixels: solanaPixels } = (await solanaRes.json()) as {
        pixels?: Record<string, { owner: string; listPrice: number; forSale: boolean }>;
      };

      setPixels((prev) => {
        const next = new Map(prev);
        baseResults.forEach((r) => {
          const solana = solanaPixels?.[String(r.id)];
          next.set(r.id, {
            id: r.id,
            x: r.x,
            y: r.y,
            owner: solana ? solana.owner : r.owner,
            price: solana ? solana.listPrice : r.price,
            forSale: solana ? solana.forSale : r.forSale,
            exists: !!solana || r.exists,
            chain: solana ? "solana" : (r.exists ? "base" : undefined),
          });
        });
        return next;
      });
    },
    [client]
  );

  useEffect(() => {
    if (!client) return;
    setLoading(true);
    fetchChunk(offset.x, offset.y, VISIBLE, VISIBLE).finally(() => setLoading(false));
  }, [client, offset.x, offset.y, fetchChunk]);

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
      <div
        className="overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
        onWheel={handleWheel}
        style={{
          width: VISIBLE * PIXEL_SIZE,
          height: VISIBLE * PIXEL_SIZE,
          minWidth: 320,
          maxWidth: "min(95vw, 720px)",
          maxHeight: "min(70vh, 720px)",
        }}
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-zinc-500">
            Loading…
          </div>
        ) : (
          <div
            className="relative grid shrink-0"
            style={{
              gridTemplateColumns: `repeat(${VISIBLE}, ${PIXEL_SIZE}px)`,
              gridTemplateRows: `repeat(${VISIBLE}, ${PIXEL_SIZE}px)`,
            }}
          >
            {pixelIds.map((id) => (
              <PixelCell
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
        <PixelModal
          pixelId={selectedId}
          data={pixels.get(selectedId) ?? null}
          onClose={() => setSelectedId(null)}
          onUpdate={() => fetchChunk(offset.x, offset.y, VISIBLE, VISIBLE)}
        />
      )}
    </div>
  );
}
