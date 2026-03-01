/**
 * Verify a message signed by a Solana wallet (Ed25519).
 * message: plain string; signature: base64; publicKey: base58.
 */
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export function verifySolanaSignature(
  message: string,
  signatureBase64: string,
  publicKeyBase58: string
): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signatureBase64, "base64");
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    const pubKey = new PublicKey(publicKeyBase58);
    const pubKeyBytes = pubKey.toBytes();
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
  } catch {
    return false;
  }
}
