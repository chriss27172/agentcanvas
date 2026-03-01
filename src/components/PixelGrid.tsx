"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { PixelModal } from "./PixelModal";
import { BulkBuyModal } from "./BulkBuyModal";
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

const ZERO = "0x0000000000000000000000000000000000000000";

export function PixelGrid() {
  const searchParams = useSearchParams();
  const { address: baseAddress } = useAccount();
  const { publicKey: solanaPubkey } = useWallet();
  const solanaAddress = solanaPubkey?.toBase58() ?? null;
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
  // Drag selection: { minX, minY, maxX, maxY } in grid coords (inclusive)
  const [selection, setSelection] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Init canvas 1000×1000 and paint gray so it's never blank
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

  // Draw: create fresh ImageData each time so we never depend on stale ref; fill gray then paint pixelData
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width !== GRID_SIZE || canvas.height !== GRID_SIZE) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = EMPTY_COLOR[0];
      img.data[i + 1] = EMPTY_COLOR[1];
      img.data[i + 2] = EMPTY_COLOR[2];
      img.data[i + 3] = 255;
    }
    pixelData.forEach((pixel, id) => {
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
    // Subtle grid every 100px so users see where they click when pixels look uniform
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 100; i < GRID_SIZE; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, GRID_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(GRID_SIZE, i);
      ctx.stroke();
    }
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

    let timeout: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      setLoading(true);
      timeout = setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 8000);
      try {
        // 1) Solana first (one request) — show it right away
        const solanaJson = await fetch(`/api/solana-pixels?startId=0&endId=${TOTAL}`).then((r) => r.json());
        if (cancelled) return;
        const solanaMap = parseSolana(solanaJson);
        setPixelData(solanaMap);
        setLoading(false);
        if (timeout) clearTimeout(timeout);

        // 2) Base in chunks, merge as we go (background)
        const solanaIds = new Set(solanaMap.keys());
        for (let start = 0; start < TOTAL && !cancelled; start += CHUNK_SIZE) {
          const end = Math.min(start + CHUNK_SIZE, TOTAL);
          const json = await fetch(`/api/base-pixels?startId=${start}&endId=${end}`).then((r) => r.json());
          if (cancelled) return;
          setPixelData((prev) => {
            const next = new Map(prev);
            parseBase(json).forEach((p) => {
              if (!solanaIds.has(p.id)) next.set(p.id, p);
            });
            return next;
          });
        }
      } catch {
        if (timeout) clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const getCell = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GRID_SIZE / rect.width;
    const scaleY = GRID_SIZE / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;
    return { x, y };
  }, []);

  const [dragPreview, setDragPreview] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCell(e);
      if (!cell) return;
      dragStartRef.current = cell;
      setDragPreview(null);
    },
    [getCell]
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
        if (!dragStartRef.current) return;
      }
      const id = x * GRID_SIZE + y;
      setHoverId(id);
      setHoverPos({ x: e.clientX, y: e.clientY });
      const start = dragStartRef.current;
      if (start && e.buttons === 1) {
        const minX = Math.min(start.x, x);
        const maxX = Math.max(start.x, x);
        const minY = Math.min(start.y, y);
        const maxY = Math.max(start.y, y);
        setDragPreview({ minX, minY, maxX, maxY });
      }
    },
    [getCell]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCell(e);
      const start = dragStartRef.current;
      dragStartRef.current = null;
      setDragPreview(null);
      if (start && cell && (start.x !== cell.x || start.y !== cell.y)) {
        const minX = Math.min(start.x, cell.x);
        const maxX = Math.max(start.x, cell.x);
        const minY = Math.min(start.y, cell.y);
        const maxY = Math.max(start.y, cell.y);
        setSelection({ minX, minY, maxX, maxY });
        return;
      }
      if (cell) {
        const id = cell.x * GRID_SIZE + cell.y;
        setSelectedId(id);
      }
    },
    [getCell]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverId(null);
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setDragPreview(null);
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

  const selectionStats = useMemo(() => {
    if (!selection) return null;
    const ids: number[] = [];
    for (let py = selection.minY; py <= selection.maxY; py++)
      for (let px = selection.minX; px <= selection.maxX; px++) ids.push(px * GRID_SIZE + py);
    let unclaimed = 0;
    let listed = 0;
    let ownedByYou = 0;
    const listedItems: { id: number; price: number; owner: string; chain?: string }[] = [];
    ids.forEach((id) => {
      const p = pixelData.get(id);
      if (!p) {
        unclaimed++;
        return;
      }
      if (p.owner && p.owner !== ZERO && (baseAddress?.toLowerCase() === p.owner.toLowerCase() || solanaAddress === p.owner)) {
        ownedByYou++;
        return;
      }
      if (p.forSale) {
        listed++;
        listedItems.push({ id, price: p.price, owner: p.owner, chain: p.chain });
      } else if (!p.exists || p.owner === ZERO) {
        unclaimed++;
      }
    });
    return { ids, unclaimed, listed, ownedByYou, listedItems };
  }, [selection, pixelData, baseAddress, solanaAddress]);

  const [bulkBuyIds, setBulkBuyIds] = useState<number[] | null>(null);

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-full">
      <p className="text-center text-sm text-zinc-500">
        Full 1000×1000 grid · Scroll to pan · Drag to select multiple · Hover for owner · Click to buy or sell
      </p>
      <div
        ref={containerRef}
        className="relative rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-auto"
        style={{ maxWidth: "min(1000px, 96vw)", maxHeight: "70vh" }}
      >
        <div className="relative" style={{ width: GRID_SIZE, height: GRID_SIZE }}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-500 text-sm">
              Loading pixels…
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={GRID_SIZE}
            height={GRID_SIZE}
            className="cursor-crosshair block shrink-0"
            style={{ width: GRID_SIZE, height: GRID_SIZE, imageRendering: "pixelated" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
          {(selection || dragPreview) && (() => {
            const r = selection ?? dragPreview!;
            const left = r.minX;
            const top = r.minY;
            const w = r.maxX - r.minX + 1;
            const h = r.maxY - r.minY + 1;
            return (
              <div
                className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-500/20"
                style={{ left, top, width: w, height: h }}
                aria-hidden
              />
            );
          })()}
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
      </div>
      {selection && selectionStats && (
        <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-sm">
          <span className="text-zinc-300">
            Selected <strong className="text-white">{selectionStats.ids.length}</strong> pixels:{" "}
            <strong className="text-emerald-400">{selectionStats.unclaimed}</strong> unclaimed,{" "}
            <strong className="text-amber-400">{selectionStats.listed}</strong> listed,{" "}
            <strong className="text-violet-400">{selectionStats.ownedByYou}</strong> yours
          </span>
          {selectionStats.unclaimed > 0 && (
            <button
              type="button"
              onClick={() => setBulkBuyIds(selectionStats.ids.filter((id) => {
                const p = pixelData.get(id);
                return !p || !p.exists || p.owner === ZERO;
              }))}
              className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500"
            >
              Buy {selectionStats.unclaimed} unclaimed
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="rounded bg-zinc-600 px-3 py-1.5 text-zinc-200 hover:bg-zinc-500"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={() => {
              const idsStr = selectionStats.ids.join(",");
              void navigator.clipboard.writeText(idsStr);
            }}
            className="rounded bg-zinc-600 px-3 py-1.5 text-zinc-200 hover:bg-zinc-500"
            title="Copy pixel IDs for API / OpenClaw agents"
          >
            Copy IDs for agents
          </button>
        </div>
      )}
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
      {bulkBuyIds !== null && bulkBuyIds.length > 0 && (
        <BulkBuyModal
          pixelIds={bulkBuyIds}
          pixelData={pixelData}
          onClose={() => setBulkBuyIds(null)}
          onUpdate={() => {
            bulkBuyIds.forEach((id) => refetchPixel(id));
          }}
        />
      )}
    </div>
  );
}
