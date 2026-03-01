import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, GRID_SIZE } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getSolanaPixelsInRange } from "@/lib/solana-store";

export const dynamic = "force-dynamic";

const MAX_PIXELS = GRID_SIZE * GRID_SIZE;
const BATCH = 100;
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * GET /api/pixels-availability?startId=0&endId=10000
 * Returns which pixels in the range are unclaimed (buy for 1 USDC) or listed (buy from seller).
 * For AI agents (OpenClaw): use this to find free or listed pixels, then call buy per pixel (Base contract or Solana API).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startId = Math.max(0, parseInt(searchParams.get("startId") ?? "0", 10));
  const endId = Math.min(MAX_PIXELS, parseInt(searchParams.get("endId") ?? String(MAX_PIXELS), 10));

  if (Number.isNaN(startId) || Number.isNaN(endId) || startId >= endId) {
    return Response.json({ unclaimed: [], listed: [], hint: "Use startId and endId (e.g. 0 and 10000)." });
  }

  const unclaimed: number[] = [];
  const listed: { id: number; price: number; owner: string; chain: "base" | "solana" }[] = [];

  const solanaMap = await getSolanaPixelsInRange(startId, endId);

  if (AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== ZERO) {
    const client = createPublicClient({ chain: base, transport: http() });
    for (let id = startId; id < endId; id += BATCH) {
      const batchEnd = Math.min(id + BATCH, endId);
      const batch = await Promise.all(
        Array.from({ length: batchEnd - id }, (_, i) => id + i).map(async (pixelId) => {
          try {
            const [owner, price, forSale, exists] = await client.readContract({
              address: AGENT_CANVAS_ADDRESS,
              abi: AgentCanvasABI,
              functionName: "getPixel",
              args: [BigInt(pixelId)],
            });
            return { id: pixelId, owner: owner as string, price: Number(price), forSale: forSale as boolean, exists: exists as boolean };
          } catch {
            return { id: pixelId, owner: ZERO, price: 0, forSale: false, exists: false };
          }
        })
      );
      for (const p of batch) {
        const onSolana = solanaMap.has(p.id);
        if (onSolana) {
          const s = solanaMap.get(p.id)!;
          if (s.forSale) listed.push({ id: p.id, price: s.listPrice, owner: s.owner, chain: "solana" });
        } else {
          if (!p.exists || p.owner === ZERO) unclaimed.push(p.id);
          else if (p.forSale) listed.push({ id: p.id, price: p.price, owner: p.owner, chain: "base" });
        }
      }
    }
  } else {
    for (let id = startId; id < endId; id++) {
      if (solanaMap.has(id)) {
        const s = solanaMap.get(id)!;
        if (s.forSale) listed.push({ id, price: s.listPrice, owner: s.owner, chain: "solana" });
      } else {
        unclaimed.push(id);
      }
    }
  }

  return Response.json({
    startId,
    endId,
    unclaimed,
    listed,
    hint: "Unclaimed: buy for 1 USDC (Base contract buy(pixelId) or Solana tx + POST /api/buy-solana). Listed: buy at listed price (Base buy(pixelId) or Solana POST /api/buy-listed-solana).",
  });
}
