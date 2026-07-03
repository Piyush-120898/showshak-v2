// ═══════════════════════════════════════════════════════════════
// supabase/functions/delete-clip/index.ts — curator-owned clip delete
// (Deno Edge Function).
// ───────────────────────────────────────────────────────────────
// FLOW:
//   browser (curator JWT) ──POST { contentId, muxOnly? }──▶ this function
//     • verify the caller owns the clip (creator_id = auth.uid())
//     • best-effort Mux cleanup (asset + in-flight upload)
//     • unless muxOnly: soft-delete the content row (deleted_at + removed)
//
// muxOnly=true: Mux cleanup only (DB soft-delete already done client-side).
//
// AUTH: JWT verification ON (same posture as mux-upload-url).
// Mux secrets stay server-side via _shared/mux.ts.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { muxFetch } from "../_shared/mux.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Best-effort DELETE for one Mux asset id; never throws. */
async function deleteMuxAsset(assetId: string | null | undefined): Promise<void> {
  if (!assetId || typeof assetId !== "string") return;
  try {
    await muxFetch(`/video/v1/assets/${assetId}`, { method: "DELETE" });
  } catch (err) {
    console.error("mux asset delete failed", assetId, err);
  }
}

/** Best-effort cancel of a direct upload; never throws. */
async function cancelMuxUpload(uploadId: string | null | undefined): Promise<void> {
  if (!uploadId || typeof uploadId !== "string") return;
  try {
    await muxFetch(`/video/v1/uploads/${uploadId}`, { method: "DELETE" });
  } catch (err) {
    console.error("mux upload cancel failed", uploadId, err);
  }
}

async function cleanupMuxForRow(row: {
  mux_asset_id?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const meta = (row.meta && typeof row.meta === "object") ? row.meta : {};
  await deleteMuxAsset(row.mux_asset_id);
  await deleteMuxAsset(typeof meta.mux_clip_asset_id === "string" ? meta.mux_clip_asset_id : null);
  await deleteMuxAsset(typeof meta.mux_source_asset_id === "string" ? meta.mux_source_asset_id : null);
  await cancelMuxUpload(typeof meta.mux_upload_id === "string" ? meta.mux_upload_id : null);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { contentId?: unknown; muxOnly?: unknown };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_body" }, 400);
  }
  const contentId = typeof body.contentId === "string" ? body.contentId.trim() : "";
  const muxOnly = body.muxOnly === true;
  if (!contentId) return json({ error: "missing_content_id" }, 400);

  let query = supabase
    .from("content")
    .select("id, mux_asset_id, meta, status")
    .eq("id", contentId)
    .eq("creator_id", user.id);

  if (!muxOnly) {
    query = query.is("deleted_at", null);
  }

  const { data: row, error: readErr } = await query.maybeSingle();

  if (readErr) {
    console.error("delete-clip read failed", readErr.message);
    return json({ error: "read_failed" }, 500);
  }
  if (!row) return json({ error: "not_found" }, 404);

  await cleanupMuxForRow(row);

  if (muxOnly) {
    return json({ ok: true, muxOnly: true });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("content")
    .update({ status: "removed", deleted_at: now })
    .eq("id", row.id)
    .eq("creator_id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (updErr) {
    console.error("delete-clip update failed", updErr.message);
    return json({ error: "delete_failed" }, 500);
  }
  if (!updated || updated.length === 0) return json({ error: "not_found" }, 404);

  return json({ ok: true });
});
