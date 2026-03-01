import { NextRequest } from "next/server";
import { getAllSolanaPixelIds, getSolanaPixel } from "@/lib/solana-store";
import { GRID_SIZE } from "@/config/contracts";

export const dynamic = "force-dynamic";

/** GET /api/my-pixels?owner=ADDRESS
 * Returns pixels owned by the given address.
 * - Solana (base58): returns all from store.
 * - Base (0x...): returns [] with hint to use base-pixels in chunks client-side (scanning 1M is too slow in one request).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  if (!owner || typeof owner !== "string") {
    return Response.json({ error: "Missing owner" }, { status: 400 });
  }

  const isBase = owner.startsWith("0x") && owner.length >= 40;

  if (isBase) {
    return Response.json({
      chain: "base",
      pixels: [],
      hint: "Fetch GET /api/base-pixels?startId=0&endId=10000 (then 10000-20000, ...) and filter by owner client-side.",
    });
  }

  const ids = await getAllSolanaPixelIds();
  const pixels: Array<{ id: number; x: number; y: number; listPrice: number; forSale: boolean }> = [];
  for (const id of ids) {
    const s = await getSolanaPixel(id);
    if (s && s.owner === owner) {
      pixels.push({
        id,
        x: Math.floor(id / GRID_SIZE),
        y: id % GRID_SIZE,
        listPrice: s.listPrice,
        forSale: s.forSale,
      });
    }
  }
  return Response.json({ chain: "solana", pixels });
}
