import { NextRequest } from "next/server";
import { getSolanaPixelsInRange, getAllSolanaPixelIds, getSolanaPixel } from "@/lib/solana-store";
import { GRID_SIZE } from "@/config/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startId = searchParams.get("startId");
  const endId = searchParams.get("endId");

  if (startId != null && endId != null) {
    const start = Math.max(0, parseInt(startId, 10));
    const end = Math.min(GRID_SIZE * GRID_SIZE, parseInt(endId, 10));
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      return Response.json({ pixels: {} });
    }
    const map = await getSolanaPixelsInRange(start, end);
    const pixels: Record<string, { owner: string; listPrice: number; forSale: boolean }> = {};
    map.forEach((v, k) => {
      pixels[String(k)] = v;
    });
    return Response.json({ pixels });
  }

  const ids = await getAllSolanaPixelIds();
  const pixels: Record<string, { owner: string; listPrice: number; forSale: boolean }> = {};
  for (const id of ids) {
    const s = await getSolanaPixel(id);
    if (s) pixels[String(id)] = s;
  }
  return Response.json({ pixelIds: ids, pixels });
}
