// ═══════════════════════════════════════════════════════════════
// supabase/functions/_shared/mux.ts — tiny Mux REST helpers (Deno)
// ───────────────────────────────────────────────────────────────
// Mirrors the server-side-secret philosophy of data/ingest-tmdb.js:
// the Mux credentials are LOCAL/SERVER-ONLY secrets that must NEVER
// reach the browser, the git repo, or any India-egress path. The
// difference here is WHERE they live — Edge Functions run on Supabase
// infrastructure, so the secrets come from Supabase FUNCTION SECRETS
// via Deno.env (set once with `supabase secrets set ...`), not a local
// data/.env file.
//
//   ╔═══════════════════════════════════════════════════════════╗
//   ║  SECURITY — READ THIS                                       ║
//   ║  MUX_TOKEN_ID / MUX_TOKEN_SECRET authenticate to the Mux    ║
//   ║  API. They are read ONLY from Deno.env (function secrets)   ║
//   ║  and are used solely to build the Basic auth header. They   ║
//   ║  are NEVER returned to callers, NEVER serialized into a     ║
//   ║  response body, and NEVER logged.                           ║
//   ╚═══════════════════════════════════════════════════════════╝
//
// NOTE: Mux webhook signature verification (verifyMuxSignature) is a
// SEPARATE concern handled in task 6.3 and is intentionally not here.
// ═══════════════════════════════════════════════════════════════

const MUX_API_BASE = "https://api.mux.com";

/**
 * Read the Mux Basic-auth credentials from function secrets. Fails fast
 * with a clear message if either secret is missing, so a misconfigured
 * deploy never silently calls Mux unauthenticated.
 *
 * The returned values are used ONLY to build the auth header below and
 * are never exposed to callers.
 */
function readMuxCredentials(): { tokenId: string; tokenSecret: string } {
  const tokenId = Deno.env.get("MUX_TOKEN_ID");
  const tokenSecret = Deno.env.get("MUX_TOKEN_SECRET");
  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Mux credentials missing: set MUX_TOKEN_ID and MUX_TOKEN_SECRET function secrets",
    );
  }
  return { tokenId, tokenSecret };
}

/**
 * Build the Mux REST Basic-auth header value from the function secrets.
 * Mux authenticates with HTTP Basic auth of `tokenId:tokenSecret`.
 *
 * Returns the full header value (e.g. "Basic <base64>"). The underlying
 * secrets are never returned — only the derived header.
 */
export function muxAuthHeader(): string {
  const { tokenId, tokenSecret } = readMuxCredentials();
  return `Basic ${btoa(`${tokenId}:${tokenSecret}`)}`;
}

/**
 * Call a Mux REST endpoint with Basic auth attached. A thin wrapper over
 * `fetch` that prefixes the Mux API base, injects the auth + JSON headers,
 * and JSON-encodes the body when present.
 *
 * @param path   Mux API path beginning with "/", e.g. "/video/uploads".
 * @param init   Standard fetch init; `body` may be a plain object (it is
 *               JSON-stringified) or a string. Caller-supplied headers are
 *               merged on top of the defaults.
 * @returns      The raw `Response`; the caller inspects `res.ok`/parses JSON.
 *
 * The Mux secret never appears in the returned Response — only the
 * Authorization request header carries the derived Basic credential.
 */
export async function muxFetch(
  path: string,
  init: (Omit<RequestInit, "body"> & { body?: unknown }) = {},
): Promise<Response> {
  const { body, headers, ...rest } = init;
  const encodedBody = body === undefined || typeof body === "string"
    ? body
    : JSON.stringify(body);
  return await fetch(`${MUX_API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: muxAuthHeader(),
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: encodedBody as BodyInit | null | undefined,
  });
}

/**
 * Mint a Mux direct-upload URL — the browser-to-Mux upload mechanism.
 * Convenience wrapper used by the mux-upload-url function (task 6.2).
 *
 * @param corsOrigin  Origin allowed to PUT bytes to the upload URL
 *                    (the app origin); Mux enforces this on the upload.
 * @returns           Mux's `{ data: { id, url, ... } }` payload as parsed
 *                    JSON. The caller returns ONLY `{ uploadUrl, uploadId }`
 *                    to the browser — never the Mux secret.
 * @throws            If Mux responds non-OK, with the status for the caller
 *                    to translate into a 502.
 */
export async function createDirectUpload(
  corsOrigin: string,
): Promise<{ data: { id: string; url: string; [k: string]: unknown } }> {
  const res = await muxFetch("/video/v1/uploads", {
    method: "POST",
    body: {
      new_asset_settings: {
        playback_policy: ["public"],
        // "Basic" quality tier (Req 4.4): input/encoding is FREE on Mux's
        // pay-as-you-go plan and storage/delivery are far cheaper — built for
        // UGC short clips. Keeps per-clip cost near-zero at ShowShak's scale.
        video_quality: "basic",
      },
      cors_origin: corsOrigin,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`mux_upload_create_failed: ${res.status} ${detail}`);
  }
  return await res.json();
}
