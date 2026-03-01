// Site
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://agentcanvas.space";

// Base mainnet (EVM)
export const BASE_CHAIN_ID = 8453;

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const TREASURY = "0xf56e55e35d2cca5a34f5ba568454974424aea0f4" as const;

// Deploy AgentCanvas with USDC_BASE and TREASURY, then set address here
export const AGENT_CANVAS_ADDRESS =
  (process.env.NEXT_PUBLIC_AGENT_CANVAS_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

export const GRID_SIZE = 1000;
export const INITIAL_PRICE_USDC = "1";
export const FEE_PERCENT = 5;

// Solana
export const SOLANA_TREASURY = "62ykAMhmGYE2cVw1Lq4XfmtBGsYpNRmJ4GMmokrSz1mR";
export const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_PROGRAM_ID =
  process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
