import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, GRID_SIZE, BASE_RPC_URL } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";

export const dynamic = "force-dynamic";

const MAX_PIXELS = GRID_SIZE * GRID_SIZE;
const BATCH = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startId = Math.max(0, parseInt(searchParams.get("startId") ?? "0", 10));
  const endId = Math.min(MAX_PIXELS, parseInt(searchParams.get("endId") ?? String(MAX_PIXELS), 10));

  if (Number.isNaN(startId) || Number.isNaN(endId) || startId >= endId) {
    return Response.json({ pixels: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  if (!AGENT_CANVAS_ADDRESS || AGENT_CANVAS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    const empty = Array.from({ length: endId - startId }, (_, i) => ({
      id: startId + i,
      owner: "0x0000000000000000000000000000000000000000",
      price: 0,
      forSale: false,
      exists: false,
    }));
    return Response.json({ pixels: empty }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const client = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  const pixels: Array<{ id: number; owner: string; price: number; forSale: boolean; exists: boolean }> = [];
  const ZERO = "0x0000000000000000000000000000000000000000";

  for (let id = startId; id < endId; id += BATCH) {
    const batchEnd = Math.min(id + BATCH, endId);
    const contracts = Array.from({ length: batchEnd - id }, (_, i) => ({
      address: AGENT_CANVAS_ADDRESS,
      abi: AgentCanvasABI,
      functionName: "getPixel" as const,
      args: [BigInt(id + i)] as const,
    }));
    const results = await client.multicall({ contracts, allowFailure: true });
    for (let i = 0; i < results.length; i++) {
      const pixelId = id + i;
      const r = results[i];
      if (r.status === "success" && r.result && Array.isArray(r.result)) {
        const [owner, price, forSale, exists] = r.result;
        pixels.push({
          id: pixelId,
          owner: (owner as string) ?? ZERO,
          price: Number(price ?? 0),
          forSale: Boolean(forSale),
          exists: Boolean(exists),
        });
      } else {
        pixels.push({
          id: pixelId,
          owner: ZERO,
          price: 0,
          forSale: false,
          exists: false,
        });
      }
    }
  }

  return Response.json({ pixels }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
