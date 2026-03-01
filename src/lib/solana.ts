import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  SOLANA_PROGRAM_ID,
  SOLANA_TREASURY,
  USDC_MINT_SOLANA,
  GRID_SIZE,
} from "@/config/contracts";

const PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_ID);
const MAX_PIXELS = GRID_SIZE * GRID_SIZE;
const PIXEL_ACCOUNT_SIZE = 8 + 32 + 8 + 1; // discriminator + owner + price + for_sale

export interface SolanaPixel {
  id: number;
  x: number;
  y: number;
  owner: string;
  price: number;
  forSale: boolean;
  exists: boolean;
}

export function getCanvasPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("canvas")], PROGRAM_ID);
  return pda;
}

export function getPixelPda(pixelId: number): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(pixelId, 0);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("pixel"), buf], PROGRAM_ID);
  return pda;
}

export function getProfilePda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function decodePixelAccount(data: Buffer, id: number): SolanaPixel {
  const x = Math.floor(id / GRID_SIZE);
  const y = id % GRID_SIZE;
  if (data.length < PIXEL_ACCOUNT_SIZE) {
    return { id, x, y, owner: "", price: 0, forSale: false, exists: false };
  }
  const owner = new PublicKey(data.subarray(8, 8 + 32));
  const price = data.readBigUInt64LE(8 + 32);
  const forSale = data[8 + 32 + 8] !== 0;
  const empty = owner.equals(PublicKey.default);
  return {
    id,
    x,
    y,
    owner: owner.toBase58(),
    price: Number(price),
    forSale,
    exists: !empty,
  };
}

export async function fetchSolanaProfile(
  connection: Connection,
  owner: PublicKey
): Promise<{ displayName: string; twitter: string; website: string; ca: string } | null> {
  const pda = getProfilePda(owner);
  const info = await connection.getAccountInfo(pda);
  if (!info?.data || info.data.length < 8) return null;
  const data = info.data;
  let offset = 8;
  function readString(): string {
    if (offset + 4 > data.length) return "";
    const len = data.readUInt32LE(offset);
    offset += 4;
    if (offset + len > data.length) return "";
    const s = data.subarray(offset, offset + len).toString("utf8");
    offset += len;
    return s;
  }
  return {
    displayName: readString(),
    twitter: readString(),
    website: readString(),
    ca: readString(),
  };
}

export async function fetchSolanaPixels(
  connection: Connection,
  startX: number,
  startY: number,
  w: number,
  h: number
): Promise<Map<number, SolanaPixel>> {
  const ids: number[] = [];
  for (let y = startY; y < startY + h && y < GRID_SIZE; y++) {
    for (let x = startX; x < startX + w && x < GRID_SIZE; x++) {
      ids.push(x * GRID_SIZE + y);
    }
  }
  const pdas = ids.map((id) => getPixelPda(id));
  const infos = await connection.getMultipleAccountsInfo(pdas);
  const result = new Map<number, SolanaPixel>();
  ids.forEach((id, i) => {
    const info = infos[i];
    if (info?.data) {
      result.set(id, decodePixelAccount(info.data, id));
    } else {
      const x = Math.floor(id / GRID_SIZE);
      const y = id % GRID_SIZE;
      result.set(id, { id, x, y, owner: "", price: 0, forSale: false, exists: false });
    }
  });
  return result;
}

export function getUsdcAta(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    new PublicKey(USDC_MINT_SOLANA),
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

// Anchor instruction discriminators: first 8 bytes of sha256("global:<ix_name>")
const DISCR = {
  buy: Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]),
  list_pixel: Buffer.from([0x38, 0x67, 0x95, 0x47, 0x93, 0x44, 0x60, 0x45]),
  unlist_pixel: Buffer.from([0x10, 0xac, 0xce, 0x76, 0xa3, 0x1a, 0x0d, 0xf9]),
  set_profile: Buffer.from([0xdd, 0xdd, 0xc3, 0x79, 0x85, 0x47, 0x71, 0xaa]),
};

function borshString(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length, 0);
  return Buffer.concat([len, b]);
}

export function createBuyInstruction(
  buyer: PublicKey,
  pixelId: number,
  sellerUsdc?: PublicKey
): TransactionInstruction {
  const canvas = getCanvasPda();
  const pixel = getPixelPda(pixelId);
  const treasury = new PublicKey(SOLANA_TREASURY);
  const usdcMint = new PublicKey(USDC_MINT_SOLANA);
  const buyerUsdc = getUsdcAta(buyer);
  const treasuryUsdc = getUsdcAta(treasury);
  const data = Buffer.alloc(8 + 4);
  DISCR.buy.copy(data, 0);
  data.writeUInt32LE(pixelId, 8);

  const keys = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: canvas, isSigner: false, isWritable: false },
    { pubkey: pixel, isSigner: false, isWritable: true },
    { pubkey: usdcMint, isSigner: false, isWritable: false },
    { pubkey: buyerUsdc, isSigner: false, isWritable: true },
    { pubkey: treasuryUsdc, isSigner: false, isWritable: true },
    { pubkey: sellerUsdc ?? treasuryUsdc, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

export function createListPixelInstruction(owner: PublicKey, pixelId: number, price: number): TransactionInstruction {
  const pixel = getPixelPda(pixelId);
  const data = Buffer.alloc(8 + 4 + 8);
  DISCR.list_pixel.copy(data, 0);
  data.writeUInt32LE(pixelId, 8);
  data.writeBigUInt64LE(BigInt(price), 12);
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: pixel, isSigner: false, isWritable: true },
  ];
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

export function createUnlistPixelInstruction(owner: PublicKey, pixelId: number): TransactionInstruction {
  const pixel = getPixelPda(pixelId);
  const data = Buffer.alloc(8 + 4);
  DISCR.unlist_pixel.copy(data, 0);
  data.writeUInt32LE(pixelId, 8);
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: pixel, isSigner: false, isWritable: true },
  ];
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

export function createSetProfileInstruction(
  owner: PublicKey,
  displayName: string,
  twitter: string,
  website: string,
  ca: string
): TransactionInstruction {
  const profilePda = getProfilePda(owner);
  const data = Buffer.concat([
    DISCR.set_profile,
    borshString(displayName),
    borshString(twitter),
    borshString(website),
    borshString(ca),
  ]);
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}