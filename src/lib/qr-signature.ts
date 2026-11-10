import crypto from "crypto";

const EVENT_QR_SECRET =
  process.env.EVENT_QR_SECRET || "ivc-eventra-secure-salt-2026-tamper-guard";

/**
 * Generates an 8-character cryptographic HMAC-SHA256 signature for a team ID.
 * This guarantees the QR badge was produced by the official Eventra platform.
 */
export function generateQrSignature(teamId: string): string {
  if (!teamId) return "";
  return crypto
    .createHmac("sha256", EVENT_QR_SECRET)
    .update(teamId.toLowerCase().trim())
    .digest("hex")
    .slice(0, 8);
}

/**
 * Validates a team ID against its HMAC signature.
 * Returns true if valid, false if tampered or mismatched.
 */
export function verifyQrSignature(teamId: string, sig?: string | null): boolean {
  if (!teamId || !sig) return false;
  const expected = generateQrSignature(teamId);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

