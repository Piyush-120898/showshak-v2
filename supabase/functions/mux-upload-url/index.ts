// ═══════════════════════════════════════════════════════════════
// supabase/functions/mux-upload-url/index.ts — mint a Mux direct-upload
// URL for an authenticated curator (Deno Edge Function).
// ───────────────────────────────────────────────────────────────
// FLOW (step 1 of the upload pipeline):
//   browser (curator JWT) ──POST──▶ this function
//     • verify the caller is an authenticated user (Req 1.3 / 11.3)
//     • mint a Mux direct-upload via the Mux API using the server-only
//       Mux secret (Req 1.1 / 1.2)
//     • return ONLY { uploadUrl, uploadId } — never the Mux secret
//   browser then PUTs the file bytes straight to uploadUrl (browser→Mux,
//   never through Supabase), and inserts a `content` row in 'processing'.
//
// AUTH: this function keeps Supabase JWT verification ON (deployed
// WITHOUT --no-verify-jwt). We ALSO re-check the user here defensively.
//
// SECURITY: MUX_TOKEN_ID / MUX_TOKEN_SECRET are read only inside
// _shared/mux.ts from function secrets; they are never returned or logged.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createDirectUpload } from "../_shared/mux.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) AUTH GATE — must be an authenticated user (Req 1.3 / 11.3).
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // 1b) RATE LIMIT — minting a Mux upload URL costs money, so cap per curator
  //     (default 20/hour). Runs through the ss_rate_allow SECURITY DEFINER RPC
  //     (migration 0037) keyed on the caller's user id. FAIL-OPEN: a transient
  //     RPC error never blocks a legitimate curator.
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc("ss_rate_allow", {
      p_bucket: "mux_upload",
      p_subject: user.id,
      p_limit: 20,
      p_window_seconds: 3600,
    });
    if (!rlErr && allowed === false) {
      return json({ error: "rate_limited" }, 429);
    }
  } catch (_e) { /* fail-open — never block a legit upload on a limiter hiccup */ }

  // 2) MINT a Mux direct-upload (secret used only inside createDirectUpload).
  const appOrigin = Deno.env.get("APP_ORIGIN") ?? "*";
  let mux: { data: { id: string; url: string } };
  try {
    mux = await createDirectUpload(appOrigin);
  } catch (_e) {
    // Log the real Mux rejection reason SERVER-SIDE only; never return it to
    // the browser (avoids leaking Mux internals). Generic body for the client.
    const detail = (_e && (_e as Error).message) ? (_e as Error).message : String(_e);
    console.error("mux-upload-url failed:", detail);
    return json({ error: "mux_upload_create_failed" }, 502);
  }

  // 3) RETURN only the upload URL + id (NEVER the Mux secret — Req 1.2).
  return json({ uploadUrl: mux.data.url, uploadId: mux.data.id });
});
