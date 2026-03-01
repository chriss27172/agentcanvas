/**
 * Persistent store for Solana pixels, profiles and transaction history.
 * Uses Vercel KV when KV_REST_API_URL and KV_REST_API_TOKEN are set; otherwise in-memory.
 * Base: pixels and profiles are on-chain (AgentCanvas contract) — always permanent.
 */

export interface SolanaPixelState {
  owner: string;
  listPrice: number;
  forSale: boolean;
}

export interface SolanaProfile {
  displayName: string;
  twitter: string;
  website: string;
  ca: string;
}

/** Event stored for Solana actions (buy, list, unlist, buy_listed) for transaction history */
export interface SolanaTxEvent {
  type: "buy" | "list" | "unlist" | "buy_listed";
  pixelId: number;
  from?: string;
  to?: string;
  price?: number;
  txSignature?: string;
  timestamp: number;
}

const PIXEL_PREFIX = "pixel:";
const PROFILE_PREFIX = "profile:solana:";
const EVENTS_KEY = "events:solana";

// In-memory fallback
const memoryPixels = new Map<number, SolanaPixelState>();
const memoryProfiles = new Map<string, SolanaProfile>();
const memoryEvents: SolanaTxEvent[] = [];

type KvClient = {
  get: (k: string) => Promise<string | null>;
  set: (k: string, v: string) => Promise<void>;
  scan: (cursor: number, opts: { match: string }) => Promise<[string, string[]]>;
  lpush: (key: string, ...values: string[]) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  llen: (key: string) => Promise<number>;
};

function getKv(): KvClient | null {
  if (typeof process === "undefined") return null;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { kv } = require("@vercel/kv") as { kv: KvClient };
    return kv;
  } catch {
    return null;
  }
}

async function kvKeys(kv: KvClient, pattern: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = 0;
  do {
    const [next, keys] = await kv.scan(cursor, { match: pattern });
    cursor = parseInt(next, 10) || 0;
    out.push(...keys);
  } while (cursor !== 0);
  return out;
}

export async function getSolanaPixel(pixelId: number): Promise<SolanaPixelState | null> {
  const kv = getKv();
  if (kv) {
    const raw = await kv.get(PIXEL_PREFIX + pixelId);
    if (raw && typeof raw === "string") return JSON.parse(raw) as SolanaPixelState;
    if (raw && typeof raw === "object" && raw !== null) return raw as SolanaPixelState;
    return null;
  }
  return memoryPixels.get(pixelId) ?? null;
}

export async function setSolanaPixel(pixelId: number, state: SolanaPixelState): Promise<void> {
  const kv = getKv();
  if (kv) {
    await kv.set(PIXEL_PREFIX + pixelId, JSON.stringify(state));
    return;
  }
  memoryPixels.set(pixelId, state);
}

export async function getSolanaPixelsInRange(startId: number, endId: number): Promise<Map<number, SolanaPixelState>> {
  const kv = getKv();
  if (kv) {
    const keys = await kvKeys(kv, PIXEL_PREFIX + "*");
    const out = new Map<number, SolanaPixelState>();
    for (const k of keys) {
      const id = parseInt(k.slice(PIXEL_PREFIX.length), 10);
      if (Number.isNaN(id) || id < startId || id >= endId) continue;
      const raw = await kv.get(k);
      if (raw && typeof raw === "string") out.set(id, JSON.parse(raw) as SolanaPixelState);
      else if (raw && typeof raw === "object" && raw !== null) out.set(id, raw as SolanaPixelState);
    }
    return out;
  }
  const out = new Map<number, SolanaPixelState>();
  for (let id = startId; id < endId; id++) {
    const s = memoryPixels.get(id);
    if (s) out.set(id, s);
  }
  return out;
}

export async function getAllSolanaPixelIds(): Promise<number[]> {
  const kv = getKv();
  if (kv) {
    const keys = await kvKeys(kv, PIXEL_PREFIX + "*");
    return keys
      .map((k) => parseInt(k.slice(PIXEL_PREFIX.length), 10))
      .filter((id) => !Number.isNaN(id));
  }
  return Array.from(memoryPixels.keys());
}

export async function getSolanaProfile(address: string): Promise<SolanaProfile | null> {
  const kv = getKv();
  const key = PROFILE_PREFIX + address;
  if (kv) {
    const raw = await kv.get(key);
    if (raw && typeof raw === "string") return JSON.parse(raw) as SolanaProfile;
    if (raw && typeof raw === "object" && raw !== null) return raw as SolanaProfile;
    return null;
  }
  return memoryProfiles.get(address) ?? null;
}

export async function setSolanaProfile(address: string, profile: SolanaProfile): Promise<void> {
  const kv = getKv();
  const key = PROFILE_PREFIX + address;
  if (kv) {
    await kv.set(key, JSON.stringify(profile));
    return;
  }
  memoryProfiles.set(address, profile);
}

export async function appendSolanaEvent(event: SolanaTxEvent): Promise<void> {
  const kv = getKv();
  const payload = JSON.stringify(event);
  if (kv) {
    await kv.lpush(EVENTS_KEY, payload);
    return;
  }
  memoryEvents.unshift(event);
}

export async function getSolanaEvents(offset: number, limit: number): Promise<SolanaTxEvent[]> {
  const kv = getKv();
  if (kv) {
    const raw = await kv.lrange(EVENTS_KEY, offset, offset + limit - 1);
    return raw.map((s) => (typeof s === "string" ? JSON.parse(s) : s) as SolanaTxEvent);
  }
  return memoryEvents.slice(offset, offset + limit);
}

export async function getSolanaEventsCount(): Promise<number> {
  const kv = getKv();
  if (kv) {
    return await kv.llen(EVENTS_KEY);
  }
  return memoryEvents.length;
}
