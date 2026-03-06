import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getSolanaEvents, getSolanaEventsCount } from "@/lib/solana-store";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BASE_EVENTS_LIMIT = 500;

export interface TransactionRow {
  chain: "base" | "solana";
  type: "buy" | "list" | "unlist" | "buy_listed";
  pixelId: number;
  from?: string;
  to?: string;
  price?: number;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const offset = (page - 1) * limit;

  const baseRows: TransactionRow[] = [];

  if (AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      const latestBlock = await client.getBlockNumber();
      const fromBlock = latestBlock > BigInt(BASE_EVENTS_LIMIT * 200) ? latestBlock - BigInt(BASE_EVENTS_LIMIT * 200) : BigInt(0);

      const [bought, listed, unlisted] = await Promise.all([
        client.getContractEvents({
          address: AGENT_CANVAS_ADDRESS,
          abi: AgentCanvasABI,
          eventName: "PixelBought",
          fromBlock,
          toBlock: latestBlock,
        }),
        client.getContractEvents({
          address: AGENT_CANVAS_ADDRESS,
          abi: AgentCanvasABI,
          eventName: "PixelListed",
          fromBlock,
          toBlock: latestBlock,
        }),
        client.getContractEvents({
          address: AGENT_CANVAS_ADDRESS,
          abi: AgentCanvasABI,
          eventName: "PixelUnlisted",
          fromBlock,
          toBlock: latestBlock,
        }),
      ]);

      const blockNumbers = new Set<bigint>();
      for (const e of bought) {
        if (e.blockNumber != null) blockNumbers.add(e.blockNumber);
      }
      for (const e of listed) {
        if (e.blockNumber != null) blockNumbers.add(e.blockNumber);
      }
      for (const e of unlisted) {
        if (e.blockNumber != null) blockNumbers.add(e.blockNumber);
      }
      const blockTimestampCache = new Map<bigint, number>();
      await Promise.all(
        [...blockNumbers].slice(0, 100).map(async (bn) => {
          try {
            const block = await client.getBlock({ blockNumber: bn });
            if (block?.timestamp) blockTimestampCache.set(bn, Number(block.timestamp) * 1000);
          } catch {
            // ignore
          }
        })
      );
      const getBlockTs = (bn: bigint) => blockTimestampCache.get(bn) ?? 0;

      for (const e of bought) {
        const args = e.args as { pixelId?: bigint; buyer?: string; previousOwner?: string; pricePaid?: bigint };
        baseRows.push({
          chain: "base",
          type: "buy",
          pixelId: Number(args.pixelId ?? 0),
          from: args.previousOwner,
          to: args.buyer,
          price: Number(args.pricePaid ?? 0),
          txHash: e.transactionHash,
          blockNumber: Number(e.blockNumber ?? 0),
          timestamp: getBlockTs(e.blockNumber ?? BigInt(0)),
        });
      }
      for (const e of listed) {
        const args = e.args as { pixelId?: bigint; owner?: string; price?: bigint };
        baseRows.push({
          chain: "base",
          type: "list",
          pixelId: Number(args.pixelId ?? 0),
          from: args.owner,
          price: Number(args.price ?? 0),
          txHash: e.transactionHash,
          blockNumber: Number(e.blockNumber ?? 0),
          timestamp: getBlockTs(e.blockNumber ?? BigInt(0)),
        });
      }
      for (const e of unlisted) {
        const args = e.args as { pixelId?: bigint; owner?: string };
        baseRows.push({
          chain: "base",
          type: "unlist",
          pixelId: Number(args.pixelId ?? 0),
          from: args.owner,
          txHash: e.transactionHash,
          blockNumber: Number(e.blockNumber ?? 0),
          timestamp: getBlockTs(e.blockNumber ?? BigInt(0)),
        });
      }
    } catch (err) {
      console.error("transactions base events:", err);
    }
  }

  const [solanaEvents, solanaTotal] = await Promise.all([
    getSolanaEvents(0, 2000),
    getSolanaEventsCount(),
  ]);

  const solanaRows: TransactionRow[] = solanaEvents.map((ev) => ({
    chain: "solana",
    type: ev.type,
    pixelId: ev.pixelId,
    from: ev.from,
    to: ev.to,
    price: ev.price,
    txHash: ev.txSignature,
    timestamp: ev.timestamp,
  }));

  const merged = [...baseRows, ...solanaRows].sort((a, b) => {
    const ta = a.timestamp ?? 0;
    const tb = b.timestamp ?? 0;
    return tb - ta;
  });

  const total = merged.length;
  const paginated = merged.slice(offset, offset + limit);

  return Response.json({
    transactions: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
