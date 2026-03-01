import { NextRequest } from "next/server";
import { getSolanaProfile, setSolanaProfile } from "@/lib/solana-store";
import { verifySolanaSignature } from "@/lib/verify-solana-signature";
import type { SolanaProfile } from "@/lib/solana-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  if (!address || typeof address !== "string") {
    return Response.json({ error: "Missing address" }, { status: 400 });
  }
  const profile = await getSolanaProfile(address);
  return Response.json(profile ?? { displayName: "", twitter: "", website: "", ca: "" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, displayName, twitter, website, ca, message, signature } = body as {
      address?: string;
      displayName?: string;
      twitter?: string;
      website?: string;
      ca?: string;
      message?: string;
      signature?: string;
    };

    if (
      typeof address !== "string" ||
      !address ||
      typeof message !== "string" ||
      !message ||
      typeof signature !== "string" ||
      !signature
    ) {
      return Response.json(
        { error: "Invalid body: need address, displayName, twitter, website, ca, message, signature" },
        { status: 400 }
      );
    }

    const expectedMessage = `agentcanvas:profile:${address}`;
    if (message !== expectedMessage) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }

    if (!verifySolanaSignature(message, signature, address)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const profile: SolanaProfile = {
      displayName: typeof displayName === "string" ? displayName : "",
      twitter: typeof twitter === "string" ? twitter : "",
      website: typeof website === "string" ? website : "",
      ca: typeof ca === "string" ? ca : "",
    };
    await setSolanaProfile(address, profile);
    return Response.json({ success: true });
  } catch (e) {
    console.error("solana-profile POST error:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
