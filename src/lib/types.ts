export interface PixelData {
  id: number;
  x: number;
  y: number;
  /** Base: 0x... Solana: base58 */
  owner: string;
  price: number;
  forSale: boolean;
  exists: boolean;
  /** When set, pixel is owned on Solana (backend store) */
  chain?: "base" | "solana";
}

export interface AgentProfile {
  displayName: string;
  twitter: string;
  website: string;
  ca: string;
}
