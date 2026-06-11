// ═══════════════════════════════════════════════════════════════
// supabase/functions/_shared/cors.ts — shared CORS headers (Deno)
// ───────────────────────────────────────────────────────────────
// The FIRST Edge Function code in the project. These headers are sent
// on every Edge Function response (and on the OPTIONS preflight) so the
// browser app can call the functions cross-origin.
//
// Origin policy: permissive by default (`*`) so local/dev origins work
// out of the box, but tightened to APP_ORIGIN automatically when that
// function secret is set in production. Tighten by simply setting the
// APP_ORIGIN secret — no code change required.
//
// Allowed request headers: Authorization (the caller's Supabase JWT)
// and Content-Type (JSON bodies). Allowed methods: POST (the functions'
// only verb) and OPTIONS (the CORS preflight).
// ═══════════════════════════════════════════════════════════════

/**
 * The app origin to allow, read from the APP_ORIGIN function secret.
 * Falls back to "*" (permissive) when unset so development works; set
 * APP_ORIGIN in production to lock the allow-list to the deployed app.
 */
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";

/**
 * CORS headers shared by every Edge Function response. Spread these into
 * each Response's headers, e.g. `{ ...corsHeaders, "Content-Type": ... }`.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  // supabase-js sends apikey + x-client-info (and a version header) on every
  // call, so they MUST be allowed here or the browser preflight blocks the
  // request before the function runs.
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
