// ═══════════════════════════════════════════════════════════════
// supabase/functions/_shared/cors.ts — shared CORS headers (Deno)
// ───────────────────────────────────────────────────────────────
// The FIRST Edge Function code in the project. These headers are sent
// on every Edge Function response (and on the OPTIONS preflight) so the
// browser app can call the functions cross-origin.
//
// Origin policy: an ALLOW-LIST read from the APP_ORIGIN function secret
// (comma-separated). The response echoes back the caller's Origin when
// it is on the list, so MULTIPLE app domains work from one secret
// (apex + www + old GitHub Pages + *.pages.dev previews). When APP_ORIGIN
// is unset the policy is restrictive by default. Local development may opt in
// to permissive CORS with ALLOW_ANY_CORS=true; production never does.
//
//   APP_ORIGIN="https://showshak.com,https://www.showshak.com,https://piyush-120898.github.io"
//
// Allowed request headers: Authorization (the caller's Supabase JWT),
// apikey + x-client-info (supabase-js sends these on every call) and
// Content-Type. Allowed methods: POST and OPTIONS (the CORS preflight).
// ═══════════════════════════════════════════════════════════════

/**
 * The configured allow-list, parsed once from APP_ORIGIN. Empty array
 * means "unset" → permissive `*` (development default).
 */
const ALLOWED_ORIGINS: string[] = (Deno.env.get("APP_ORIGIN") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOW_ANY = ALLOWED_ORIGINS.length === 0 &&
  Deno.env.get("ALLOW_ANY_CORS") === "true" &&
  Deno.env.get("APP_ENV") !== "production";
const DEFAULT_ORIGIN = ALLOWED_ORIGINS[0] ?? "https://showshak.com";

const BASE_HEADERS: Record<string, string> = {
  // supabase-js sends apikey + x-client-info (and a version header) on every
  // call, so they MUST be allowed here or the browser preflight blocks the
  // request before the function runs.
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

/**
 * Resolve the `Access-Control-Allow-Origin` value for a caller's Origin.
 * Echoes the caller back when allow-listed; otherwise falls back to the
 * first configured origin (a safe, non-`*` default) so a stray origin is
 * simply not granted access rather than leaking `*`.
 */
function resolveOrigin(requestOrigin: string | null): string {
  if (ALLOW_ANY) return "*";
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return DEFAULT_ORIGIN;
}

/**
 * CORS is not an authorization boundary, but rejecting an explicit foreign
 * browser origin prevents side-effect endpoints from doing work for a page
 * that cannot legitimately call the app. Requests without Origin (CLI/webhook)
 * are handled by the endpoint's normal authentication/signature gates.
 */
export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("Origin");
  return !origin || ALLOW_ANY || ALLOWED_ORIGINS.includes(origin);
}

/**
 * Build the CORS headers for a specific request. Pass the incoming Request
 * (or its Origin header). Spread the result into each Response's headers,
 * e.g. `{ ...corsHeadersFor(req), "Content-Type": "application/json" }`.
 */
export function corsHeadersFor(
  reqOrOrigin: Request | string | null,
): Record<string, string> {
  const origin = typeof reqOrOrigin === "string" || reqOrOrigin === null
    ? reqOrOrigin
    : reqOrOrigin.headers.get("Origin");
  return {
    ...BASE_HEADERS,
    "Access-Control-Allow-Origin": resolveOrigin(origin),
  };
}

/**
 * Back-compat static headers (permissive origin). Prefer corsHeadersFor(req)
 * so multi-origin allow-listing works; this remains for any caller that has
 * no request in scope.
 */
export const corsHeaders: Record<string, string> = {
  ...BASE_HEADERS,
  "Access-Control-Allow-Origin": ALLOW_ANY ? "*" : DEFAULT_ORIGIN,
};
