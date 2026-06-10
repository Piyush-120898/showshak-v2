// ═══════════════════════════════════════════════════════════════
// verify-signature.test.ts — Deno property tests for the Mux webhook
// signature verifier + the idempotency model (mux-video-clips, task 6.5).
//
// Run (requires Deno; not installed in every dev box):
//     deno test supabase/functions/_shared/verify-signature.test.ts
//
// Covers design Correctness Properties:
//   Property 7 — signature verification accepts only authentic events
//   Property 8 — the ready-flip is idempotent (same input → same final state)
// ═══════════════════════════════════════════════════════════════

import { verifyMuxSignature } from "./verify-signature.ts";

const enc = new TextEncoder();
const ITER = 150;
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const randStr = (n: number) =>
  Array.from({ length: n }, () => String.fromCharCode(randInt(33, 126))).join("");

/* Sign a body the way Mux does: HMAC-SHA256(secret, "<ts>.<raw>") as hex. */
async function signMux(raw: string, secret: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

// ── Property 7: only authentic, fresh signatures verify ──
// Feature: mux-video-clips, Property 7
Deno.test("Property 7: signature verification accepts authentic events, rejects tampering", async () => {
  for (let i = 0; i < ITER; i++) {
    const secret = randStr(randInt(8, 40));
    const raw = JSON.stringify({ type: "video.asset.ready", n: i, blob: randStr(randInt(0, 60)) });
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signMux(raw, secret, ts);

    // Authentic + fresh → true.
    assert(await verifyMuxSignature(raw, `t=${ts},v1=${sig}`, secret), "authentic must verify");

    // Tampered body → false.
    assert(!await verifyMuxSignature(raw + "x", `t=${ts},v1=${sig}`, secret), "tampered body must fail");
    // Tampered signature → false.
    const badSig = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    assert(!await verifyMuxSignature(raw, `t=${ts},v1=${badSig}`, secret), "tampered sig must fail");
    // Wrong secret → false.
    assert(!await verifyMuxSignature(raw, `t=${ts},v1=${sig}`, secret + "!"), "wrong secret must fail");
    // Stale timestamp (> 5 min) → false.
    const staleTs = ts - 1000;
    const staleSig = await signMux(raw, secret, staleTs);
    assert(!await verifyMuxSignature(raw, `t=${staleTs},v1=${staleSig}`, secret), "stale ts must fail");
    // Malformed header → false.
    assert(!await verifyMuxSignature(raw, "garbage", secret), "malformed header must fail");
  }
});

/* Pure model of the webhook's flip, mirroring mux-webhook/index.ts: a row is
   flipped to 'live' (with the asset's playback fields) ONLY while it is still
   'processing'; once 'live' it is untouched. This is exactly the guard
   `.eq('status','processing')` expressed as a pure function so idempotency is
   property-testable without a database. */
function applyReadyFlip(row: { status: string; mux_playback_id?: string | null },
                        asset: { id: string; playback_ids?: { id: string }[]; duration?: number }) {
  if (row.status !== "processing") return row;        // already live / removed → no-op
  const playbackId = asset.playback_ids?.[0]?.id ?? null;
  return {
    ...row,
    status: "live",
    mux_asset_id: asset.id,
    mux_playback_id: playbackId,
    thumbnail_url: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null,
    duration_sec: asset.duration ? Math.round(asset.duration) : null,
  };
}

// ── Property 8: the ready-flip is idempotent ──
// Feature: mux-video-clips, Property 8
Deno.test("Property 8: applying the ready flip 2+ times equals applying it once", () => {
  for (let i = 0; i < ITER; i++) {
    const row = { id: "c" + i, status: "processing", mux_playback_id: null };
    const asset = { id: "asset_" + i, playback_ids: [{ id: "pbk_" + i }], duration: randInt(0, 90) };
    const once = applyReadyFlip(row, asset);
    let many = applyReadyFlip(row, asset);
    const reps = randInt(1, 4);
    for (let r = 0; r < reps; r++) many = applyReadyFlip(many, asset);   // duplicate ready events
    assert(many.status === "live", "ends live");
    assert(JSON.stringify(many) === JSON.stringify(once), "idempotent: repeated flips == one flip");
  }
});
