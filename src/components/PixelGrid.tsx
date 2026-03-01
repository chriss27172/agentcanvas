"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const [pixelData, setPixelData] = useState<Map<number, PixelData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const pixelFromUrl = searchParams.get("pixel");
    if (pixelFromUrl) {
      const id = parseInt(pixelFromUrl, 10);
      if (!Number.isNaN(id) && id >= 0 && id < GRID_SIZE * GRID_SIZE) setSelectedId(id);
    }
  }, [searchParams]);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Paint gray immediately so the canvas is never blank
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = EMPTY_COLOR[0];
      img.data[i + 1] = EMPTY_COLOR[1];
      img.data[i + 2] = EMPTY_COLOR[2];
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    imageDataRef.current = img;
  }, []);

  // Redraw whenever pixelData or loading changes. Use requestAnimationFrame so paint runs after layout.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = GRID_SIZE;
    const h = GRID_SIZE;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Map(pixelData);
    const raf = requestAnimationFrame(() => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = EMPTY_COLOR[0];
        img.data[i + 1] = EMPTY_COLOR[1];
        img.data[i + 2] = EMPTY_COLOR[2];
        img.data[i + 3] = 255;
      }
      data.forEach((pixel, id) => {
        const rgb = colorForOwner(pixel.owner);
        const px = Math.floor(id / GRID_SIZE);
        const py = id % GRID_SIZE;
        const idx = (py * GRID_SIZE + px) * 4;
        img.data[idx] = rgb[0];
        img.data[idx + 1] = rgb[1];
        img.data[idx + 2] = rgb[2];
        img.data[idx + 3] = 255;
      });
      ctx.putImageData(img, 0, 0);
      imageDataRef.current = img;
    });
    return () => cancelAnimationFrame(raf);
  }, [pixelData, loading]);

  useEffect(() => {
    let cancelled = false;
    const toPixelData = (p: { id: number; owner: string; price: number; forSale: boolean; exists: boolean }): PixelData => ({
      id: p.id,
      x: Math.floor(p.id / GRID_SIZE),
      y: p.id % GRID_SIZE,
      owner: p.owner,
      price: p.price,
      forSale: p.forSale,
      exists: p.exists,
      chain: p.exists ? "base" : undefined,
    });

    function parseSolana(json: unknown): Map<number, PixelData> {
      const out = new Map<number, PixelData>();
      const pixels = (json as { pixels?: Record<string, { owner: string; listPrice: number; forSale: boolean }> }).pixels ?? {};
      for (const [idStr, s] of Object.entries(pixels)) {
        const id = parseInt(idStr, 10);
        if (Number.isNaN(id)) continue;
        out.set(id, {
          id,
          x: Math.floor(id / GRID_SIZE),
          y: id % GRID_SIZE,
          owner: s.owner,
          price: s.listPrice,
          forSale: s.forSale,
          exists: true,
          chain: "solana",
        });
      }
      return out;
    }

    function parseBase(json: unknown): PixelData[] {
      const pixels = (json as { pixels?: Array<{ id: number; owner: string; price: number; forSale: boolean; exists: boolean }> }).pixels ?? [];
      return pixels.map(toPixelData);
    }

    (async () => {
      setLoading(true);
      try {
        // Fast first paint: only Solana + first 2 Base chunks (3 requests)
        const [solanaJson, base0Json, base1Json] = await Promise.all([
          fetch(`/api/solana-pixels?startId=0&endId=${TOTAL}`).then((r) => r.json()),
          fetch(`/api/base-pixels?startId=0&endId=${CHUNK_SIZE}`).then((r) => r.json()),
          fetch(`/api/base-pixels?startId=${CHUNK_SIZE}&endId=${2 * CHUNK_SIZE}`).then((r) => r.json()),
        ]);
        if (cancelled) return;

        const merged = new Map<number, PixelData>();
        parseSolana(solanaJson).forEach((v, k) => merged.set(k, v));
        const solanaIds = new Set(merged.keys());
        [...parseBase(base0Json), ...parseBase(base1Json)].forEach((p) => {
          if (!solanaIds.has(p.id)) merged.set(p.id, p);
        });
        setPixelData(merged);
        setLoading(false);

        // Rest of Base in background, 10 chunks in parallel per wave
        for (let wave = 2; wave < 100 && !cancelled; wave += 10) {
          const promises = Array.from({ length: 10 }, (_, i) => {
            const start = (wave + i) * CHUNK_SIZE;
            if (start >= TOTAL) return Promise.resolve({ pixels: [] });
            const end = Math.min(start + CHUNK_SIZE, TOTAL);
            return fetch(`/api/base-pixels?startId=${start}&endId=${end}`).then((r) => r.json());
          });
          const results = await Promise.all(promises);
          if (cancelled) return;
          setPixelData((prev) => {
            const next = new Map(prev);
            results.forEach((json) =>
              parseBase(json).forEach((p) => {
                if (!solanaIds.has(p.id)) next.set(p.id, p);
              })
            );
            return next;
          });
        }
      } catch {
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
    <div className="flex flex-col items-center gap-2 w-full max-w-full">
      <p className="text-center text-sm text-zinc-500">
        Full 1000×1000 grid · Hover for owner · Click to buy or sell
      </p>
      <div
        ref={containerRef}
        className="relative rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden flex-shrink-0"
        style={{ width: "min(92vw, 62vh)", height: "min(92vw, 62vh)" }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-500 text-sm">
            Loading pixels…
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={GRID_SIZE}
          height={GRID_SIZE}
          className="w-full h-full cursor-pointer block object-contain"
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
              <div className="text-sm text-zinc-400">Unclaimed · 1 USDC</div>
            )}
            <div className="mt-2 text-xs text-emerald-400">Click to buy or sell</div>
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
