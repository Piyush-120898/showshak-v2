// Delete a caller-owned clip without trusting client-writable Mux fields.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { corsHeadersFor, isOriginAllowed } from "../_shared/cors.ts";
import { muxFetch } from "../_shared/mux.ts";

async function deleteMuxAsset(assetId: unknown): Promise<boolean> {
  if (typeof assetId !== "string" || !assetId) return true;
  try {
    const response = await muxFetch(`/video/v1/assets/${assetId}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error("mux asset delete failed", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function cancelMuxUpload(uploadId: unknown): Promise<boolean> {
  if (typeof uploadId !== "string" || !uploadId) return true;
  try {
    const response = await muxFetch(`/video/v1/uploads/${uploadId}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error("mux upload cancel failed", error instanceof Error ? error.message : String(error));
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...extra, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    const allowed = isOriginAllowed(req);
    return new Response(allowed ? "ok" : "forbidden", { status: allowed ? 200 : 403, headers: cors });
  }
  if (!isOriginAllowed(req)) return json({ error: "forbidden_origin" }, 403);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authHeader) return json({ error: "unauthorized" }, 401);

  let body: { contentId?: unknown; muxOnly?: unknown };
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 4 * 1024) return json({ error: "payload_too_large" }, 413);
    body = JSON.parse(raw);
  } catch (_error) {
    return json({ error: "invalid_body" }, 400);
  }
  const contentId = typeof body.contentId === "string" ? body.contentId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contentId)) {
    return json({ error: "missing_content_id" }, 400);
  }
  const muxOnly = body.muxOnly === true;

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await service.from("users").select("role,is_guest,deleted_at").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "curator" || profile.is_guest === true || profile.deleted_at) {
    return json({ error: "curator_required" }, 403);
  }

  const { data: decision, error: rateError } = await service.rpc("ss_rate_consume", {
    p_bucket: "delete_clip",
    p_subject: user.id,
  });
  if (rateError || !decision || typeof decision.allowed !== "boolean") return json({ error: "rate_limit_unavailable" }, 503);
  if (!decision.allowed) {
    const retryAfter = Math.max(1, Number(decision.retry_after_seconds) || 60);
    return json({ error: "rate_limited", retry_after: retryAfter }, 429, { "Retry-After": String(retryAfter) });
  }

  const { data: asset, error: assetError } = await service
    .from("content_assets")
    .select("content_id,owner_id,upload_id,mux_asset_id")
    .eq("content_id", contentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (assetError) return json({ error: "asset_lookup_failed" }, 503);

  // No server-owned mapping means this is a legacy/unverified row. Never use
  // its client-writable content.meta or mux fields to issue a destructive Mux call.
  if (asset) {
    const assetDeleted = await deleteMuxAsset(asset.mux_asset_id);
    const uploadCancelled = asset.mux_asset_id ? true : await cancelMuxUpload(asset.upload_id);
    if (!assetDeleted || !uploadCancelled) return json({ error: "mux_cleanup_failed" }, 502);
    const mapped = await service.from("content_assets")
      .update({ lifecycle: "removed", updated_at: new Date().toISOString() })
      .eq("content_id", contentId)
      .eq("owner_id", user.id)
      .select("content_id");
    if (mapped.error || !mapped.data?.length) return json({ error: "asset_update_failed" }, 500);
  }

  if (muxOnly) return json({ ok: true, muxOnly: true, assetCleanup: !!asset });

  const { data: updated, error: updateError } = await service
    .from("content")
    .update({ status: "removed", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", contentId)
    .eq("creator_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (updateError) return json({ error: "delete_failed" }, 500);
  if (!updated || updated.length === 0) return json({ error: "not_found" }, 404);
  return json({ ok: true });
});
