// supabase/functions/_shared/verify-signature.ts  (Deno)
//
// Pure async helper that verifies a Mux webhook signature.
//
// Mux sends a `Mux-Signature: t=<ts>,v1=<hex>` header. Authenticity is proven
// by recomputing HMAC-SHA256(secret, "<ts>.<rawBody>") and constant-time
// comparing it against the `v1` value. Stale events (replay protection) are
// rejected with a 5-minute tolerance.
//
// This module has NO Supabase/DOM dependency and only uses Web Crypto
// (`crypto.subtle`), so it is importable by a test harness that can sign a
// body and then verify it (and assert tampered body / timestamp / signature
// are rejected). See task 6.5 property tests.

const enc = new TextEncoder();

/**
 * Verify a Mux webhook signature.
 *
 * @param raw    The exact raw request body string used by Mux to sign.
 * @param header The value of the `Mux-Signature` header (`t=<ts>,v1=<hex>`).
 * @param secret The Mux webhook signing secret (`MUX_WEBHOOK_SECRET`).
 * @returns      `true` only when the signature is authentic and fresh.
 */
export async function verifyMuxSignature(
  raw: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const ts = parts["t"];
  const sig = parts["v1"];
  if (!ts || !sig) return false;
  // reject stale events (replay protection): 5-minute tolerance
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
