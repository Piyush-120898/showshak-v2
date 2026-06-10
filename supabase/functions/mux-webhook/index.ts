// ═══════════════════════════════════════════════════════════════
// supabase/functions/mux-webhook/index.ts — receive Mux asset events
// and flip the matching content row to 'live' (Deno Edge Function).
// ───────────────────────────────────────────────────────────────
// FLOW (step 2 of the upload pipeline):
//   Mux ──POST video.asset.ready (Mux-Signature header)──▶ this function
//     • verify the Mux signature (authenticity + replay window) — Req 3.3
//     • match the content row by meta->>'mux_upload_id' (the upload id we
//       stored at insert time), falling back to mux_asset_id — Req 3.4
//     • idempotently flip status 'processing' → 'live' and store
//       mux_asset_id / mux_playback_id / thumbnail_url / duration_sec — Req 3.1/3.2/3.5
//
// DEPLOY: this function is PUBLIC (Mux is not a Supabase user), so it is
// deployed WITH --no-verify-jwt. It authenticates Mux itself by verifying
// the signed body. It writes with the SERVICE ROLE (bypasses RLS) — that
// key is read only from function secrets and never reaches the browser (Req 3.6).
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMuxSignature } from "../_shared/verify-signature.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  // Raw body is required for HMAC verification — read it before JSON.parse.
  const raw = await req.text();

  // 1) VERIFY the Mux signature; reject + modify nothing on failure (Req 3.3).
  const ok = await verifyMuxSignature(
    raw,
    req.headers.get("Mux-Signature") ?? "",
    Deno.env.get("MUX_WEBHOOK_SECRET") ?? "",
  );
  if (!ok) return new Response("bad signature", { status: 401 });

  // Parse only after authenticity is proven.
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch (_e) {
    return new Response("bad json", { status: 400 });
  }

  // Only the "asset ready" event flips a clip live; acknowledge the rest.
  if (event.type !== "video.asset.ready") {
    return new Response("ignored", { status: 200 });
  }

  const asset = (event.data ?? {}) as Record<string, any>;
  const uploadId: string | null = asset.upload_id ?? null;
  const assetId: string | null = asset.id ?? null;
  const playbackId: string | null = asset.playback_ids?.[0]?.id ?? null;
  const durationSec: number | null = asset.duration ? Math.round(asset.duration) : null;
  const thumbnailUrl: string | null = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
    : null;

  // Service-role client (bypasses RLS); key is server-side only (Req 3.6).
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const patch = {
    status: "live",
    mux_asset_id: assetId,
    mux_playback_id: playbackId,
    thumbnail_url: thumbnailUrl,
    duration_sec: durationSec,
  };

  // 2) MATCH the row by the upload id we stored in meta at insert time, and
  //    only touch rows still 'processing' so a duplicate ready event is a
  //    no-op on an already-live row (idempotent — Req 3.1/3.2/3.5).
  let updated: Array<{ id: string }> | null = null;
  if (uploadId) {
    const res = await db.from("content")
      .update(patch)
      .eq("meta->>mux_upload_id", uploadId)
      .eq("status", "processing")
      .select("id");
    updated = res.data ?? null;
  }

  // Fallback: match by asset id (e.g. a row created/updated out of band).
  if ((!updated || updated.length === 0) && assetId) {
    const res = await db.from("content")
      .update(patch)
      .eq("mux_asset_id", assetId)
      .eq("status", "processing")
      .select("id");
    updated = res.data ?? null;
  }

  // No match (unknown upload, or already live) → acknowledge, change nothing
  // (Req 3.4 / 3.5). Always 200 so Mux does not retry a handled event.
  return new Response(JSON.stringify({ updated: updated?.length ?? 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
