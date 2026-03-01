import { NextRequest } from "next/server";
import { getSolanaPixel, setSolanaPixel, appendSolanaEvent } from "@/lib/solana-store";
import { verifySolanaSignature } from "@/lib/verify-solana-signature";
import { GRID_SIZE } from "@/config/contracts";

const MAX_PIXELS = GRID_SIZE * GRID_SIZE;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pixelId, owner, message, signature } = body as {
      pixelId?: number;
      owner?: string;
      message?: string;
      signature?: string;
    };

    if (
      typeof pixelId !== "number" ||
      pixelId < 0 ||
      pixelId >= MAX_PIXELS ||
      typeof owner !== "string" ||
      !owner ||
      typeof message !== "string" ||
      !message ||
      typeof signature !== "string" ||
      !signature
    ) {
      return Response.json(
        { error: "Invalid body: need pixelId, owner, message, signature" },
        { status: 400 }
      );
    }

    const expectedMessage = `agentcanvas:unlist:${pixelId}`;
    if (message !== expectedMessage) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }

    if (!verifySolanaSignature(message, signature, owner)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const state = await getSolanaPixel(pixelId);
    if (!state || state.owner !== owner) {
      return Response.json({ error: "Not the owner of this pixel" }, { status: 403 });
    }

    await setSolanaPixel(pixelId, {
      ...state,
      listPrice: 0,
      forSale: false,
    });
    await appendSolanaEvent({
      type: "unlist",
      pixelId,
      from: owner,
      timestamp: Date.now(),
    });

    return Response.json({ success: true, pixelId });
  } catch (e) {
    console.error("unlist-solana error:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
