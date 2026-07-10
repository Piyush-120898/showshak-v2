// ═══════════════════════════════════════════════════════════════
// supabase/functions/mux-webhook/index.ts — receive Mux asset events
// and flip the matching content row to 'live' (Deno Edge Function).
// ───────────────────────────────────────────────────────────────
// FLOW (step 2 of the upload pipeline):
//   Mux ──POST video.asset.ready (Mux-Signature header)──▶ this function
//     • verify the Mux signature (authenticity + replay window) — Req 3.3
//     • match the content row by meta->>'mux_upload_id' (the upload id we
//       stored at insert time), falling back to mux_asset_id — Req 3.4
//     • duration backstop: if the Mux-reported duration exceeds DURATION_CAP
//       (120 s), delete the Mux asset and mark the row 'removed' so an over-cap
//       clip never goes live — Req 4.5/4.6
//     • idempotently flip status 'processing' → 'live' and store
//       mux_asset_id / mux_playback_id / thumbnail_url / duration_sec — Req 3.1/3.2/3.5
//       (the thumbnail uses the stored meta.cover_time when present — Req 8.2)
//
// DEPLOY: this function is PUBLIC (Mux is not a Supabase user), so it is
// deployed WITH --no-verify-jwt. It authenticates Mux itself by verifying
// the signed body. It writes with the SERVICE ROLE (bypasses RLS) — that
// key is read only from function secrets and never reaches the browser (Req 3.6).
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMuxSignature } from "../_shared/verify-signature.ts";
import { muxFetch } from "../_shared/mux.ts";

// Server-side backstop for the clip length limit. Mirrors the client-side
// SS_DURATION_CAP (120 s) enforced in showshak-shared.js — kept in sync by hand
// since the Edge runtime (Deno) and the browser/Node helpers don't share a
// module. An asset whose Mux-reported duration exceeds this slipped past the
// client trim/validation and must be rejected (Req 4.5/4.6).
const DURATION_CAP = 120;

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

  // Service-role client (bypasses RLS); key is server-side only (Req 3.6).
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 2) MATCH the target row by the upload id we stored in meta at insert time,
  //    falling back to the asset id, and only consider rows still 'processing'
  //    so a duplicate ready event finds nothing → no-op (idempotent —
  //    Req 3.1/3.2/3.5). We SELECT (not update) first so we can read the row's
  //    stored meta (for meta.cover_time and a non-clobbering meta merge) and
  //    branch on duration before deciding what to write.
  type ContentRow = { id: string; meta: Record<string, any> | null };
  let row: ContentRow | null = null;
  if (uploadId) {
    const res = await db.from("content")
      .select("id, meta")
      .eq("meta->>mux_upload_id", uploadId)
      .eq("status", "processing")
      .limit(1)
      .maybeSingle();
    row = (res.data as ContentRow | null) ?? null;
  }

  // Fallback: match by asset id (e.g. a row created/updated out of band).
  if (!row && assetId) {
    const res = await db.from("content")
      .select("id, meta")
      .eq("mux_asset_id", assetId)
      .eq("status", "processing")
      .limit(1)
      .maybeSingle();
    row = (res.data as ContentRow | null) ?? null;
  }

  // Phase-2 match: the TRIMMED CLIP asset is ready. Its event carries no
  // upload_id and its id isn't on mux_asset_id yet — we stashed it in
  // meta.mux_clip_asset_id when the clip was requested (Phase 1 below), so match
  // on that. matchedByClip drives the live-flip to use the CLIP + delete the source.
  let matchedByClip = false;
  if (!row && assetId) {
    const res = await db.from("content")
      .select("id, meta")
      .eq("meta->>mux_clip_asset_id", assetId)
      .eq("status", "processing")
      .limit(1)
      .maybeSingle();
    if (res.data) { row = res.data as ContentRow; matchedByClip = true; }
  }

  // No match (unknown upload, or already live) → acknowledge, change nothing
  // (Req 3.4 / 3.5). Always 200 so Mux does not retry a handled event.
  if (!row) {
    return new Response(JSON.stringify({ updated: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta = row.meta ?? {};

  // 3) DURATION BACKSTOP (Req 4.5/4.6): an over-cap asset slipped past the
  //    client trim/validation. Reject it BEFORE the live-flip so it never goes
  //    live: delete the Mux asset and mark the row 'removed'.
  if (durationSec !== null && durationSec > DURATION_CAP) {
    // Delete the Mux asset. Wrap in try/catch so a Mux failure (network, 404,
    // already-deleted) never crashes the handler — log and continue so we
    // still mark the row removed and ACK 200.
    if (assetId) {
      try {
        await muxFetch(`/video/v1/assets/${assetId}`, { method: "DELETE" });
      } catch (err) {
        console.error("mux asset delete failed", assetId, err);
      }
    }

    // Merge rejected_reason into the EXISTING meta so other keys
    // (mux_upload_id, vibes, cover_time, trim, …) are preserved (Req 4.6).
    const mergedMeta = { ...meta, rejected_reason: "over_duration_cap" };
    await db.from("content")
      .update({
        status: "removed",
        deleted_at: new Date().toISOString(),
        meta: mergedMeta,
      })
      .eq("id", row.id)
      .eq("status", "processing");

    return new Response(JSON.stringify({ rejected: "over_duration_cap" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3.5) SERVER-SIDE TRIM (two-phase). Active only when the row recorded
  //      meta.trim = {in,out} at publish (the curator made a real cut).
  const trim = (meta && typeof meta.trim === "object" && meta.trim)
    ? meta.trim as Record<string, any>
    : null;
  const tIn = trim ? Number(trim.in) : NaN;
  const tOut = trim ? Number(trim.out) : NaN;
  const hasTrim = !!trim && isFinite(tIn) && isFinite(tOut) && tOut > tIn;

  if (!matchedByClip && hasTrim) {
    // Duplicate SOURCE-ready after we already requested the clip → the clip's
    // own ready event (Phase 2) will finish the job. Change nothing.
    if (meta.mux_clip_asset_id) {
      return new Response(JSON.stringify({ clip_pending: meta.mux_clip_asset_id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // PHASE 1 — the SOURCE asset is ready: create a CLIP asset for [in,out] from
    // it (Mux instant clipping via mux://assets/<id>), remember both ids, and
    // stay 'processing'. The clip fires its OWN video.asset.ready, handled by
    // Phase 2 (flip live with the clip + delete the source → only the trimmed
    // part survives). On ANY failure we fall through and publish the full source
    // so the curator is never stuck.
    if (assetId) {
      try {
        const clipRes = await muxFetch("/video/v1/assets", {
          method: "POST",
          body: {
            input: [{ url: `mux://assets/${assetId}`, start_time: tIn, end_time: tOut }],
            playback_policy: ["public"],
            video_quality: "basic",
          },
        });
        if (!clipRes.ok) {
          const detail = await clipRes.text().catch(() => "");
          throw new Error(`mux_clip_create_failed: ${clipRes.status} ${detail}`);
        }
        const clipJson = await clipRes.json();
        const clipAssetId: string | null = clipJson?.data?.id ?? null;
        if (!clipAssetId) throw new Error("mux_clip_no_id");
        const mergedMeta = { ...meta, mux_clip_asset_id: clipAssetId, mux_source_asset_id: assetId };
        await db.from("content")
          .update({ meta: mergedMeta })
          .eq("id", row.id)
          .eq("status", "processing");
        return new Response(JSON.stringify({ clip_requested: clipAssetId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("mux clip create failed; publishing full source", err);
        // fall through → normal live-flip with the SOURCE asset.
      }
    }
  }

  // 4) NORMAL live-flip. Use the row's STORED meta.cover_time (set at insert by
  //    the upload UI) to build a cover-time thumbnail; 0 is a valid time
  //    (first frame), so check finiteness rather than truthiness (Req 8.2).
  const coverTime: number | null =
    meta && typeof meta.cover_time === "number" && isFinite(meta.cover_time)
      ? meta.cover_time
      : null;
  const thumbnailUrl: string | null = playbackId
    ? (coverTime !== null
      ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${coverTime}`
      : `https://image.mux.com/${playbackId}/thumbnail.jpg`)
    : null;

  // Update by id (read+write on the same row avoids a re-match race); keep the
  // status='processing' guard for extra idempotency. Do NOT write meta here —
  // only the rejected branch touches meta.
  const res = await db.from("content")
    .update({
      status: "live",
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      thumbnail_url: thumbnailUrl,
      duration_sec: durationSec,
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .select("id");
  const updated = res.data ?? null;

  // PHASE 2 cleanup: the trimmed clip is now live — delete the SOURCE asset so
  // only the trimmed part is stored (the full upload is discarded). Best-effort;
  // a Mux failure here never fails the webhook (the clip is already live).
  if (matchedByClip && meta.mux_source_asset_id) {
    try {
      await muxFetch(`/video/v1/assets/${meta.mux_source_asset_id}`, { method: "DELETE" });
    } catch (err) {
      console.error("mux source asset delete failed", meta.mux_source_asset_id, err);
    }
  }

  return new Response(JSON.stringify({ updated: updated?.length ?? 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
