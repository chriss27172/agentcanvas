import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL } from "@/config/contracts";
import { AgentCanvasABI } from "@/abis/AgentCanvas";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug-pixel?id=123
 * Zwraca wynik getPixel(id) z kontraktu oraz adres kontraktu.
 * Służy do weryfikacji, czy backend widzi właściciela piksela (np. po zakupie).
 */
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  const pixelId = idParam !== null ? parseInt(idParam, 10) : NaN;
  if (Number.isNaN(pixelId) || pixelId < 0 || pixelId >= 1_000_000) {
    return Response.json({ error: "Podaj id=0..999999" }, { status: 400 });
  }

  if (!AGENT_CANVAS_ADDRESS || AGENT_CANVAS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return Response.json(
      { error: "Brak AGENT_CANVAS_ADDRESS w konfiguracji (NEXT_PUBLIC_AGENT_CANVAS_ADDRESS)" }
    );
  }

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    const [owner, price, forSale, exists] = await client.readContract({
      address: AGENT_CANVAS_ADDRESS,
      abi: AgentCanvasABI,
      functionName: "getPixel",
      args: [BigInt(pixelId)],
    });
    return Response.json(
      {
        pixelId,
        agentCanvasAddress: AGENT_CANVAS_ADDRESS,
        owner: owner as string,
        price: String(price),
        forSale: Boolean(forSale),
        exists: Boolean(exists),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: "Błąd odczytu kontraktu", details: msg },
      { status: 500 }
    );
  }
}
