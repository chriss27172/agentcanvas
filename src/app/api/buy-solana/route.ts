import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { Connection } from "@solana/web3.js";
import { AGENT_CANVAS_ADDRESS, GRID_SIZE, SOLANA_RPC } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";
import { getSolanaPixel, setSolanaPixel, appendSolanaEvent } from "@/lib/solana-store";
import { verifySolanaBuyTx } from "@/lib/verify-solana-buy";

const MAX_PIXELS = GRID_SIZE * GRID_SIZE;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pixelId, txSignature, buyer } = body as {
      pixelId?: number;
      txSignature?: string;
      buyer?: string;
    };

    if (
      typeof pixelId !== "number" ||
      pixelId < 0 ||
      pixelId >= MAX_PIXELS ||
      typeof txSignature !== "string" ||
      !txSignature ||
      typeof buyer !== "string" ||
      !buyer
    ) {
      return Response.json(
        { error: "Invalid body: need pixelId (number), txSignature (string), buyer (string)" },
        { status: 400 }
      );
    }

    if (await getSolanaPixel(pixelId)) {
      return Response.json({ error: "Pixel already owned on Solana" }, { status: 409 });
    }

    if (AGENT_CANVAS_ADDRESS && AGENT_CANVAS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      const client = createPublicClient({
        chain: base,
        transport: http(),
      });
      const [owner, , , exists] = await client.readContract({
        address: AGENT_CANVAS_ADDRESS,
        abi: AgentCanvasABI,
        functionName: "getPixel",
        args: [BigInt(pixelId)],
      });
      if (exists && owner && owner !== "0x0000000000000000000000000000000000000000") {
        return Response.json({ error: "Pixel already owned on Base" }, { status: 409 });
      }
    }

    const connection = new Connection(SOLANA_RPC);
    const verification = await verifySolanaBuyTx(connection, txSignature, pixelId, buyer);
    if (!verification.ok) {
      return Response.json({ error: verification.error }, { status: 400 });
    }

    await setSolanaPixel(pixelId, {
      owner: buyer,
      listPrice: 0,
      forSale: false,
    });
    await appendSolanaEvent({
      type: "buy",
      pixelId,
      to: buyer,
      price: 1_000_000,
      txSignature,
      timestamp: Date.now(),
    });

    return Response.json({ success: true, pixelId });
  } catch (e) {
    console.error("buy-solana error:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
