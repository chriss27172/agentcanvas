import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getAllSolanaPixelIds, getSolanaPixel } from "@/lib/solana-store";

export const dynamic = "force-dynamic";

const MAX_LISTED_BASE = 300;
const MAX_LISTED_SOLANA = 500;

export interface ListedPixel {
  id: number;
  price: number;
  owner: string;
  chain: "base" | "solana";
}

export async function GET(request: NextRequest) {
  const listed: ListedPixel[] = [];

  if (AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      const events = await client.getContractEvents({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        eventName: "PixelListed",
        fromBlock: BigInt(0),
      });
      const byBlock = [...events].sort((a, b) => Number((b.blockNumber ?? BigInt(0)) - (a.blockNumber ?? BigInt(0))));
      const seen = new Set<number>();
      const idsToCheck: number[] = [];
      for (const e of byBlock) {
        const id = e.args?.pixelId != null ? Number(e.args.pixelId) : undefined;
        if (id !== undefined && !seen.has(id) && idsToCheck.length < MAX_LISTED_BASE) {
          seen.add(id);
          idsToCheck.push(id);
        }
      }
      const BATCH = 50;
      for (let i = 0; i < idsToCheck.length; i += BATCH) {
        const chunk = idsToCheck.slice(i, i + BATCH);
        const results = await Promise.all(
          chunk.map(async (pixelId) => {
            try {
              const [owner, price, forSale] = await client.readContract({
                address: AGENT_CANVAS_ADDRESS,
                abi: AgentCanvasABI,
                functionName: "getPixel",
                args: [BigInt(pixelId)],
              });
              if (forSale && owner && owner !== "0x0000000000000000000000000000000000000000") {
                return { id: pixelId, price: Number(price), owner: owner as string, chain: "base" as const };
              }
            } catch {
              // skip
            }
            return null;
          })
        );
        for (const r of results) {
          if (r) listed.push(r);
        }
      }
    } catch {
      // ignore Base errors
    }
  }

  try {
    const solanaIds = await getAllSolanaPixelIds();
    let checked = 0;
    for (const id of solanaIds) {
      if (listed.filter((p) => p.chain === "solana").length >= MAX_LISTED_SOLANA) break;
      if (checked >= MAX_LISTED_SOLANA * 2) break;
      checked++;
      const p = await getSolanaPixel(id);
      if (p?.forSale && p.owner) {
        listed.push({
          id,
          price: p.listPrice,
          owner: p.owner,
          chain: "solana",
        });
      }
    }
  } catch {
    // ignore Solana errors
  }

  listed.sort((a, b) => a.id - b.id);
  return Response.json(
    { listed },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
