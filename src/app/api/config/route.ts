import { AGENT_CANVAS_ADDRESS, BASE_RPC_URL } from "@/config/contracts";

export const dynamic = "force-dynamic";

/**
 * GET /api/config
 * Zwraca adres kontraktu i RPC używane przez backend – do weryfikacji w Vercel.
 * Otwórz w przeglądarce i porównaj z adresem kontraktu na Basescan (transakcja zakupu).
 */
export async function GET() {
  return Response.json(
    {
      agentCanvasAddress: AGENT_CANVAS_ADDRESS || null,
      baseRpcUrl: BASE_RPC_URL || null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
