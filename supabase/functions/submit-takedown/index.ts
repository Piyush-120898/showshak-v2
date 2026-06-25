// ═══════════════════════════════════════════════════════════════
// supabase/functions/submit-takedown/index.ts — public DMCA takedown
// intake endpoint for non-logged-in complainants (Deno Edge Function).
// ───────────────────────────────────────────────────────────────
// FLOW (Phase 1 of the notice-and-takedown machinery — Req 3.1/3.3/3.4):
//   anyone (NO login) ──POST { notice }──▶ this function
//     • re-validate well-formedness SERVER-SIDE with wellFormed() — the
//       SAME rules as ssDmcaNoticeWellFormed in showshak-shared.js
//       (defense in depth; never trust the client) — Req 3.3/3.4
//     • on NOT ok → 400 { ok:false, missing:[...] } and create NOTHING
//     • on ok → call the ss_submit_complaint(payload jsonb) SECURITY
//       DEFINER RPC (migration 0029). The RPC re-validates a THIRD time
//       and does the insert + 'received' audit append atomically, then
//       returns ONLY { confirmation_ref } — Req 3.5
//
// AUTH/DEPLOY: this endpoint is PUBLIC (a complainant need not be a
// ShowShak user), so the founder deploys it WITHOUT Supabase JWT
// verification:
//     supabase functions deploy submit-takedown --no-verify-jwt
// It uses the anon key only; ss_submit_complaint is the one write path
// (SECURITY DEFINER) so an anon caller can CREATE a well-formed complaint
// but can never read the queue, choose a state, or enumerate anything.
//
// CORS: open like the other functions (import ../_shared/cors.ts), so the
// browser intake form (showshak-dmca.html) can call it cross-origin.
//
// WHY wellFormed() is re-implemented inline: Deno cannot import the
// browser/Node helpers in showshak-shared.js (that file is a window/CommonJS
// dual-export module, not a Deno ESM module). So the SAME rules are copied
// here line-for-line and must be kept in sync by hand — the same posture as
// the DURATION_CAP mirror in mux-webhook/index.ts.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Anti-abuse: reject oversized bodies before parsing. A well-formed notice is
// at most a few KB (work_identification 2000 + target_url 2000 + the short
// fields); 64 KB is a generous cap that still blocks abusive payloads.
const MAX_BODY_BYTES = 64 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── wellFormed(notice) — server-side mirror of ssDmcaNoticeWellFormed ──
// Returns { ok, missing }. `missing` lists the stable key of each failing
// element so the caller (and the form) can name it (Req 3.4). Keys:
//   work_identification | target | complainant_name | complainant_email |
//   good_faith | accuracy_authority | signature
// Pure: no side effects, does NOT mutate `notice`. Null/undefined → every key.
type DmcaNotice = {
  work_identification?: unknown;
  content_id?: unknown;
  target_url?: unknown;
  complainant_name?: unknown;
  complainant_email?: unknown;
  good_faith?: unknown;
  accuracy_authority?: unknown;
  signature?: unknown;
};

// True iff `v` is a string whose trimmed length is within [min, max] inclusive.
// Whitespace-only strings have trimmed length 0 → fail a min of 1.
function trimmedLenInBounds(v: unknown, min: number, max: number): boolean {
  if (typeof v !== "string") return false;
  const len = v.trim().length;
  return len >= min && len <= max;
}

function wellFormed(notice: unknown): { ok: boolean; missing: string[] } {
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const missing: string[] = [];
  const n: DmcaNotice | null =
    notice && typeof notice === "object" ? (notice as DmcaNotice) : null;

  // work_identification: string, trimmed length 1..2000
  if (!n || !trimmedLenInBounds(n.work_identification, 1, 2000)) {
    missing.push("work_identification");
  }

  // target: a non-empty content_id OR a target_url string trimmed length 1..2000
  const contentIdOk =
    !!n && typeof n.content_id === "string" && n.content_id.trim().length >= 1;
  const targetUrlOk = !!n && trimmedLenInBounds(n.target_url, 1, 2000);
  if (!(contentIdOk || targetUrlOk)) missing.push("target");

  // complainant_name: string, trimmed length 1..200
  if (!n || !trimmedLenInBounds(n.complainant_name, 1, 200)) {
    missing.push("complainant_name");
  }

  // complainant_email: matches local@domain.tld
  if (!n || typeof n.complainant_email !== "string" || !EMAIL_RE.test(n.complainant_email)) {
    missing.push("complainant_email");
  }

  // good_faith / accuracy_authority: strict boolean true
  if (!n || n.good_faith !== true) missing.push("good_faith");
  if (!n || n.accuracy_authority !== true) missing.push("accuracy_authority");

  // signature: string, trimmed length 1..200
  if (!n || !trimmedLenInBounds(n.signature, 1, 200)) missing.push("signature");

  return { ok: missing.length === 0, missing };
}

// Exported for the Deno test (the handler itself is wired via Deno.serve and
// is not exported, mirroring the mux-webhook test posture).
export { wellFormed };

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) ANTI-ABUSE size cap. Reject an oversized body before reading/parsing.
  //    Trust Content-Length when present; also hard-cap the actual bytes read.
  const lenHeader = req.headers.get("Content-Length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  // 2) Tolerate malformed JSON → 400, create nothing.
  let notice: unknown;
  try {
    notice = JSON.parse(raw);
  } catch (_e) {
    return json({ ok: false, error: "bad_json", missing: [] }, 400);
  }

  // 3) RE-VALIDATE well-formedness server-side (Req 3.3/3.4). On NOT ok →
  //    400 with the failing element keys; create NOTHING.
  const verdict = wellFormed(notice);
  if (!verdict.ok) {
    return json({ ok: false, missing: verdict.missing }, 400);
  }

  // 4) On ok → call ss_submit_complaint (SECURITY DEFINER). The RPC
  //    re-validates a THIRD time and does the insert + 'received' audit
  //    append atomically, returning only { confirmation_ref } (Req 3.5).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("ss_submit_complaint", {
    payload: notice,
  });

  if (error) {
    // Log the real Postgres rejection SERVER-SIDE only; never leak DB internals
    // to the anonymous caller. Generic body for the client.
    console.error("ss_submit_complaint failed:", error.message);
    return json({ ok: false, error: "submit_failed" }, 502);
  }

  // The RPC returns the confirmation reference (shape: { confirmation_ref }
  // as a jsonb object, or a scalar text depending on the SQL return type).
  // Normalize both shapes to { ok:true, confirmation_ref }.
  const confirmation_ref =
    data && typeof data === "object" && "confirmation_ref" in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).confirmation_ref
      : data;

  return json({ ok: true, confirmation_ref });
});
