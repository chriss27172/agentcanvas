import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL, GRID_SIZE } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";

export const dynamic = "force-dynamic";

const ZERO = "0x0000000000000000000000000000000000000000";

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  if (!owner || typeof owner !== "string" || !owner.startsWith("0x")) {
    return Response.json({ pixels: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const ownerLower = owner.toLowerCase();
  if (!AGENT_CANVAS_ADDRESS || AGENT_CANVAS_ADDRESS === ZERO) {
    return Response.json({ pixels: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const events = await client.getContractEvents({
      address: AGENT_CANVAS_ADDRESS,
      abi: AgentCanvasABI,
      eventName: "PixelBought",
      fromBlock: BigInt(0),
    });

    const pixelIds = new Set<number>();
    for (const e of events) {
      const args = e.args as { buyer?: string; pixelId?: bigint } | undefined;
      if (!args || !args.buyer) continue;
      if (args.buyer.toLowerCase() !== ownerLower) continue;
      const id = args.pixelId !== undefined ? Number(args.pixelId) : NaN;
      if (!Number.isNaN(id) && id >= 0) pixelIds.add(id);
    }

    const pixels: Array<{ id: number; x: number; y: number; owner: string; price: number; forSale: boolean }> = [];
    const ids = Array.from(pixelIds);
    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map(async (pixelId) => {
          try {
            const [currentOwner, price, forSale, exists] = await client.readContract({
              address: AGENT_CANVAS_ADDRESS,
              abi: AgentCanvasABI,
              functionName: "getPixel",
              args: [BigInt(pixelId)],
            });
            const o = (currentOwner as string).toLowerCase();
            if (exists && o === ownerLower) {
              return {
                id: pixelId,
                x: Math.floor(pixelId / GRID_SIZE),
                y: pixelId % GRID_SIZE,
                owner: currentOwner as string,
                price: Number(price),
                forSale: forSale as boolean,
              };
            }
          } catch {
            // skip
          }
          return null;
        })
      );
      for (const r of results) {
        if (r) pixels.push(r);
      }
    }

    pixels.sort((a, b) => a.id - b.id);
    return Response.json({ pixels }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return Response.json({ pixels: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
