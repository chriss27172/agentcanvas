/**
 * Persistent store for Solana pixels, profiles and transaction history.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * (or KV_REST_API_URL + KV_REST_API_TOKEN) are set; otherwise in-memory.
 * Base: pixels and profiles are on-chain (AgentCanvas contract) — always permanent.
 */

import { Redis } from "@upstash/redis";

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

/** Redis client when env vars are set (Upstash or KV_*), null otherwise */
function getRedis(): Redis | null {
  if (typeof process === "undefined") return null;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function redisKeys(redis: Redis, pattern: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: pattern });
    cursor = typeof next === "string" ? parseInt(next, 10) || 0 : Number(next) ?? 0;
    out.push(...(keys ?? []));
  } while (cursor !== 0);
  return out;
}

function parsePixel(raw: unknown): SolanaPixelState | null {
  if (raw && typeof raw === "string") return JSON.parse(raw) as SolanaPixelState;
  if (raw && typeof raw === "object" && raw !== null) return raw as SolanaPixelState;
  return null;
}

function parseProfile(raw: unknown): SolanaProfile | null {
  if (raw && typeof raw === "string") return JSON.parse(raw) as SolanaProfile;
  if (raw && typeof raw === "object" && raw !== null) return raw as SolanaProfile;
  return null;
}

export async function getSolanaPixel(pixelId: number): Promise<SolanaPixelState | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(PIXEL_PREFIX + pixelId);
    return parsePixel(raw);
  }
  return memoryPixels.get(pixelId) ?? null;
}

export async function setSolanaPixel(pixelId: number, state: SolanaPixelState): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(PIXEL_PREFIX + pixelId, JSON.stringify(state));
    return;
  }
  memoryPixels.set(pixelId, state);
}

export async function getSolanaPixelsInRange(startId: number, endId: number): Promise<Map<number, SolanaPixelState>> {
  const redis = getRedis();
  if (redis) {
    const keys = await redisKeys(redis, PIXEL_PREFIX + "*");
    const out = new Map<number, SolanaPixelState>();
    for (const k of keys) {
      const id = parseInt(k.slice(PIXEL_PREFIX.length), 10);
      if (Number.isNaN(id) || id < startId || id >= endId) continue;
      const raw = await redis.get(k);
      const s = parsePixel(raw);
      if (s) out.set(id, s);
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
  const redis = getRedis();
  if (redis) {
    const keys = await redisKeys(redis, PIXEL_PREFIX + "*");
    return keys
      .map((k) => parseInt(k.slice(PIXEL_PREFIX.length), 10))
      .filter((id) => !Number.isNaN(id));
  }
  return Array.from(memoryPixels.keys());
}

export async function getSolanaProfile(address: string): Promise<SolanaProfile | null> {
  const redis = getRedis();
  const key = PROFILE_PREFIX + address;
  if (redis) {
    const raw = await redis.get(key);
    return parseProfile(raw);
  }
  return memoryProfiles.get(address) ?? null;
}

export async function setSolanaProfile(address: string, profile: SolanaProfile): Promise<void> {
  const redis = getRedis();
  const key = PROFILE_PREFIX + address;
  if (redis) {
    await redis.set(key, JSON.stringify(profile));
    return;
  }
  memoryProfiles.set(address, profile);
}

export async function appendSolanaEvent(event: SolanaTxEvent): Promise<void> {
  const redis = getRedis();
  const payload = JSON.stringify(event);
  if (redis) {
    await redis.lpush(EVENTS_KEY, payload);
    return;
  }
  memoryEvents.unshift(event);
}

export async function getSolanaEvents(offset: number, limit: number): Promise<SolanaTxEvent[]> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.lrange(EVENTS_KEY, offset, offset + limit - 1);
    return (raw ?? []).map((s) => (typeof s === "string" ? JSON.parse(s) : s) as SolanaTxEvent);
  }
  return memoryEvents.slice(offset, offset + limit);
}

export async function getSolanaEventsCount(): Promise<number> {
  const redis = getRedis();
  if (redis) {
    return (await redis.llen(EVENTS_KEY)) ?? 0;
  }
  return memoryEvents.length;
}
