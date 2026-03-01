"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { PixelModal } from "./PixelModal";
import type { PixelData } from "@/lib/types";
import { GRID_SIZE } from "@/config/contracts";

const TOTAL = GRID_SIZE * GRID_SIZE;
const CHUNK_SIZE = 10_000;
const EMPTY_COLOR = [39, 39, 42, 255]; // zinc-800

function colorForOwner(owner: string | null): [number, number, number] {
  if (!owner || owner === "0x0000000000000000000000000000000000000000")
    return [39, 39, 42];
  let h = 0;
  for (let i = 0; i < owner.length; i++) {
    h = (h << 5) - h + owner.charCodeAt(i);
    h |= 0;
  }
  const s = 0.55, l = 0.42;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h % 360) / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const k = (h % 360 + 360) % 360;
  if (k < 60) { r = c; g = x; }
  else if (k < 120) { r = x; g = c; }
  else if (k < 180) { r = 0; g = c; b = x; }
  else if (k < 240) { r = 0; g = x; b = c; }
  else if (k < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function PixelGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const [pixelData, setPixelData] = useState<Map<number, PixelData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const drawPixel = useCallback((id: number, rgb: [number, number, number]) => {
    const img = imageDataRef.current;
    if (!img) return;
    const x = Math.floor(id / GRID_SIZE);
    const y = id % GRID_SIZE;
    const i = (y * GRID_SIZE + x) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
  }, []);

  const flushCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageDataRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    imageDataRef.current = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    const img = imageDataRef.current;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = EMPTY_COLOR[0];
      img.data[i + 1] = EMPTY_COLOR[1];
      img.data[i + 2] = EMPTY_COLOR[2];
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => {
    if (!imageDataRef.current) return;
    pixelData.forEach((data, id) => {
      const rgb = colorForOwner(data.owner);
      drawPixel(id, rgb);
    });
    flushCanvas();
  }, [pixelData, drawPixel, flushCanvas]);

  useEffect(() => {
    let cancelled = false;
    const merge = (next: Map<number, PixelData>) => {
      setPixelData((prev) => {
        const m = new Map(prev);
        next.forEach((v, k) => m.set(k, v));
        return m;
      });
    };

    (async () => {
      setLoading(true);
      try {
        const solanaRes = await fetch("/api/solana-pixels");
        const solanaJson = (await solanaRes.json()) as {
          pixels?: Record<string, { owner: string; listPrice: number; forSale: boolean }>;
        };
        const solanaMap = new Map<number, PixelData>();
        if (solanaJson.pixels) {
          for (const [idStr, s] of Object.entries(solanaJson.pixels)) {
            const id = parseInt(idStr, 10);
            if (Number.isNaN(id)) continue;
            const x = Math.floor(id / GRID_SIZE);
            const y = id % GRID_SIZE;
            solanaMap.set(id, {
              id,
              x,
              y,
              owner: s.owner,
              price: s.listPrice,
              forSale: s.forSale,
              exists: true,
              chain: "solana",
            });
          }
        }
        if (!cancelled) merge(solanaMap);

        for (let start = 0; start < TOTAL && !cancelled; start += CHUNK_SIZE) {
          const end = Math.min(start + CHUNK_SIZE, TOTAL);
          const res = await fetch(`/api/base-pixels?startId=${start}&endId=${end}`);
          const json = (await res.json()) as {
            pixels?: Array<{ id: number; owner: string; price: number; forSale: boolean; exists: boolean }>;
          };
          const baseMap = new Map<number, PixelData>();
          (json.pixels ?? []).forEach((p) => {
            if (solanaMap.has(p.id)) return;
            baseMap.set(p.id, {
              id: p.id,
              x: Math.floor(p.id / GRID_SIZE),
              y: p.id % GRID_SIZE,
              owner: p.owner,
              price: p.price,
              forSale: p.forSale,
              exists: p.exists,
              chain: p.exists ? "base" : undefined,
            });
          });
          if (!cancelled) merge(baseMap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = GRID_SIZE / rect.width;
      const scaleY = GRID_SIZE / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
      const id = x * GRID_SIZE + y;
      setSelectedId(id);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = GRID_SIZE / rect.width;
      const scaleY = GRID_SIZE / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        setHoverId(null);
        return;
      }
      const id = x * GRID_SIZE + y;
      setHoverId(id);
      setHoverPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoverId(null);
  }, []);

  const refetchPixel = useCallback(async (id: number) => {
    const start = Math.floor(id / CHUNK_SIZE) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, TOTAL);
    const [baseRes, solanaRes] = await Promise.all([
      fetch(`/api/base-pixels?startId=${start}&endId=${end}`),
      fetch("/api/solana-pixels"),
    ]);
    const baseJson = (await baseRes.json()) as { pixels?: Array<{ id: number; owner: string; price: number; forSale: boolean; exists: boolean }> };
    const solanaJson = (await solanaRes.json()) as { pixels?: Record<string, { owner: string; listPrice: number; forSale: boolean }> };
    setPixelData((prev) => {
      const next = new Map(prev);
      (baseJson.pixels ?? []).forEach((p) => {
        if (solanaJson.pixels?.[String(p.id)]) return;
        next.set(p.id, {
          id: p.id,
          x: Math.floor(p.id / GRID_SIZE),
          y: p.id % GRID_SIZE,
          owner: p.owner,
          price: p.price,
          forSale: p.forSale,
          exists: p.exists,
          chain: p.exists ? "base" : undefined,
        });
      });
      if (solanaJson.pixels) {
        for (const [idStr, s] of Object.entries(solanaJson.pixels)) {
          const pid = parseInt(idStr, 10);
          if (Number.isNaN(pid)) continue;
          next.set(pid, {
            id: pid,
            x: Math.floor(pid / GRID_SIZE),
            y: pid % GRID_SIZE,
            owner: s.owner,
            price: s.listPrice,
            forSale: s.forSale,
            exists: true,
            chain: "solana",
          });
        }
      }
      return next;
    });
  }, []);

  const selectedData = selectedId !== null ? pixelData.get(selectedId) ?? null : null;
  const hoverData = hoverId !== null ? pixelData.get(hoverId) ?? null : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-zinc-500">
        Cała siatka 1000×1000 · Najedź na piksel — właściciel · Kliknij — kup/sprzedaj
      </p>
      <div
        ref={containerRef}
        className="relative w-full max-w-[min(90vw,85vh)] aspect-square rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden"
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-500 text-sm">
            Ładowanie pikseli…
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={GRID_SIZE}
          height={GRID_SIZE}
          className="w-full h-full cursor-pointer block"
          style={{ imageRendering: "pixelated" }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {hoverId !== null && hoverData && (
          <div
            className="pointer-events-none fixed z-[100] w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 shadow-xl text-left"
            style={{ left: hoverPos.x, top: hoverPos.y - 12 }}
          >
            <div className="mb-1.5 text-xs font-medium text-zinc-400">
              Pixel ({hoverData.x}, {hoverData.y})
            </div>
            {hoverData.owner && hoverData.owner !== "0x0000000000000000000000000000000000000000" ? (
              <>
                <div className="font-mono text-xs text-zinc-300 truncate">
                  {hoverData.owner.slice(0, 8)}…{hoverData.owner.slice(-6)}
                  {hoverData.chain === "solana" ? " (Solana)" : ""}
                </div>
                {hoverData.forSale && (
                  <div className="mt-1.5 text-xs text-amber-400">
                    {(hoverData.price / 1e6).toFixed(2)} USDC
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-zinc-400">Wolny · 1 USDC</div>
            )}
            <div className="mt-2 text-xs text-emerald-400">Kliknij — kup lub sprzedaj</div>
          </div>
        )}
      </div>
      {selectedId !== null && (
        <PixelModal
          pixelId={selectedId}
          data={selectedData}
          onClose={() => setSelectedId(null)}
          onUpdate={() => {
            if (selectedId !== null) refetchPixel(selectedId);
          }}
        />
      )}
    </div>
  );
}
