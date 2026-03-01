import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { getSolanaPixel, setSolanaPixel, appendSolanaEvent } from "@/lib/solana-store";
import { verifySolanaBuyListedTx } from "@/lib/verify-solana-buy-listed";
import { AGENT_CANVAS_ADDRESS, GRID_SIZE, SOLANA_RPC } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";

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

    const state = await getSolanaPixel(pixelId);
    if (!state) {
      return Response.json({ error: "Pixel not owned on Solana" }, { status: 404 });
    }
    if (!state.forSale || state.listPrice <= 0) {
      return Response.json({ error: "Pixel is not listed for sale" }, { status: 400 });
    }
    if (state.owner === buyer) {
      return Response.json({ error: "Cannot buy your own pixel" }, { status: 400 });
    }

    const connection = new Connection(SOLANA_RPC);
    const verification = await verifySolanaBuyListedTx(
      connection,
      txSignature,
      pixelId,
      buyer,
      state.owner,
      state.listPrice
    );
    if (!verification.ok) {
      return Response.json({ error: verification.error }, { status: 400 });
    }

    const seller = state.owner;
    await setSolanaPixel(pixelId, {
      owner: buyer,
      listPrice: 0,
      forSale: false,
    });
    await appendSolanaEvent({
      type: "buy_listed",
      pixelId,
      from: seller,
      to: buyer,
      price: state.listPrice,
      txSignature,
      timestamp: Date.now(),
    });

    return Response.json({ success: true, pixelId });
  } catch (e) {
    console.error("buy-listed-solana error:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
