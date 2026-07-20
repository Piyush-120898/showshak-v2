import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { corsHeadersFor, isOriginAllowed } from "../_shared/cors.ts";

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function hashSubject(value: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}|feedback|${value}`),
  );
  return Array.from(new Uint8Array(digest)).slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...headers, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    const allowed = isOriginAllowed(req);
    return new Response(allowed ? "ok" : "forbidden", { status: allowed ? 200 : 403, headers: cors });
  }
  if (!isOriginAllowed(req)) return json({ ok: false, error: "forbidden_origin" }, 403);
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const declared = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  const kind = payload.kind;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if ((kind !== "feedback" && kind !== "problem") || message.length < 1 || message.length > 2000) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  if (email && (email.length > 320 || !EMAIL_RE.test(email))) {
    return json({ ok: false, error: "invalid_email" }, 400);
  }

  const serviceUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const rateSalt = Deno.env.get("RATE_SALT") || "";
  if (!serviceUrl || !serviceKey || !rateSalt) {
    console.error("submit-feedback is misconfigured");
    return json({ ok: false, error: "unavailable" }, 503);
  }
  const db = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });

  const trustedXff = Deno.env.get("TRUST_PROXY_XFF") === "true"
    ? (req.headers.get("x-forwarded-for") || "").split(",")[0]
    : "";
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || trustedXff).trim();
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const subjectSource = ip ? `ip:${ip}` : email ? `email:${email}` : bearer ? `token:${bearer}` : "";
  if (!subjectSource) return json({ ok: false, error: "rate_identity_unavailable" }, 503);

  const subject = await hashSubject(subjectSource, rateSalt);
  const rate = await db.rpc("ss_rate_consume", { p_bucket: "feedback", p_subject: subject });
  if (rate.error || !rate.data || typeof rate.data.allowed !== "boolean") {
    console.error("submit-feedback limiter unavailable", rate.error?.message || "invalid decision");
    return json({ ok: false, error: "unavailable" }, 503);
  }
  if (!rate.data.allowed) {
    const rawRetry = Number(rate.data.retry_after_seconds);
    const retry = Number.isFinite(rawRetry) ? Math.min(86400, Math.max(1, Math.ceil(rawRetry))) : 60;
    return json({ ok: false, error: "rate_limited", retry_after: retry }, 429, { "Retry-After": String(retry) });
  }

  let subjectId: string | null = null;
  if (bearer) {
    try {
      const authResult = await db.auth.getUser(bearer);
      subjectId = authResult.data.user?.id || null;
    } catch (_error) { /* anonymous feedback remains supported */ }
  }
  const sourceMeta = payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
    ? payload.meta as Record<string, unknown>
    : {};
  const meta = {
    page: typeof sourceMeta.page === "string" ? sourceMeta.page.slice(0, 100) : undefined,
    ua: typeof sourceMeta.ua === "string" ? sourceMeta.ua.slice(0, 500) : undefined,
    url: typeof sourceMeta.url === "string" ? sourceMeta.url.slice(0, 2048) : undefined,
    viewport: typeof sourceMeta.viewport === "string" ? sourceMeta.viewport.slice(0, 40) : undefined,
    standalone: sourceMeta.standalone === true,
  };
  const insert = await db.from("feedback").insert({
    kind,
    message,
    email: email || null,
    subject_id: subjectId,
    meta,
  });
  if (insert.error) {
    console.error("submit-feedback insert failed", insert.error.message);
    return json({ ok: false, error: "submit_failed" }, 502);
  }
  return json({ ok: true });
});
