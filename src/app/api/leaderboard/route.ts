import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getAllSolanaPixelIds, getSolanaPixel } from "@/lib/solana-store";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface LeaderboardRow {
  address: string;
  count: number;
  chain: "base" | "solana";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const offset = (page - 1) * limit;

  const baseRows: LeaderboardRow[] = [];
  const solanaRows: LeaderboardRow[] = [];

  if (AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      const events = await client.getContractEvents({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        eventName: "PixelBought",
        fromBlock: 0n,
      });
      const byOwner = new Map<string, number>();
      for (const e of events) {
        const buyer = (e.args as { buyer?: string }).buyer;
        if (buyer) byOwner.set(buyer.toLowerCase(), (byOwner.get(buyer.toLowerCase()) ?? 0) + 1);
      }
      for (const [address, count] of byOwner.entries()) {
        baseRows.push({ address, count, chain: "base" });
      }
    } catch {
      // ignore
    }
  }

  try {
    const ids = await getAllSolanaPixelIds();
    const byOwner = new Map<string, number>();
    for (const id of ids) {
      const s = await getSolanaPixel(id);
      if (s) byOwner.set(s.owner, (byOwner.get(s.owner) ?? 0) + 1);
    }
    for (const [address, count] of byOwner.entries()) {
      solanaRows.push({ address, count, chain: "solana" });
    }
  } catch {
    // ignore
  }

  const merged = [...baseRows, ...solanaRows].sort((a, b) => b.count - a.count);
  const total = merged.length;
  const agents = merged.slice(offset, offset + limit);

  return Response.json({
    agents,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
