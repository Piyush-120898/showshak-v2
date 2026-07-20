// Mint a Mux direct-upload URL for an approved curator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { corsHeadersFor, isOriginAllowed } from "../_shared/cors.ts";
import { createDirectUpload } from "../_shared/mux.ts";

const MAX_BODY_BYTES = 4 * 1024;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersFor(req);
  const json = (
    body: unknown,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ): Response => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extraHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") {
    const allowed = isOriginAllowed(req);
    return new Response(allowed ? "ok" : "forbidden", {
      status: allowed ? 200 : 403,
      headers: cors,
    });
  }
  if (!isOriginAllowed(req)) return json({ error: "forbidden_origin" }, 403);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const contentLength = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authHeader) return json({ error: "unauthorized" }, 401);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Authentication alone is not upload authorization.
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await service
    .from("users")
    .select("role,is_guest,deleted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return json({ error: "authorization_unavailable" }, 503);
  if (!profile || profile.role !== "curator" || profile.is_guest === true || profile.deleted_at) {
    return json({ error: "curator_required" }, 403);
  }

  // The trusted client chooses a server-owned bucket. Callers cannot choose
  // the quota, window, bucket, or subject.
  const { data: rate, error: rateError } = await service.rpc("ss_rate_consume", {
    p_bucket: "mux_upload",
    p_subject: user.id,
  });
  if (rateError || !rate || typeof rate.allowed !== "boolean") {
    console.error("mux-upload-url limiter unavailable:", rateError?.message || "bad decision");
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  if (!rate.allowed) {
    const retryAfter = Math.max(1, Number(rate.retry_after_seconds) || 60);
    return json(
      { error: "rate_limited", retry_after: retryAfter },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const appOrigin = cors["Access-Control-Allow-Origin"] || "https://showshak.com";
  try {
    const mux = await createDirectUpload(appOrigin);
    return json({ uploadUrl: mux.data.url, uploadId: mux.data.id });
  } catch (error) {
    console.error("mux-upload-url failed:", error instanceof Error ? error.message : String(error));
    return json({ error: "mux_upload_create_failed" }, 502);
  }
});
