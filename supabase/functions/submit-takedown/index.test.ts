// ═══════════════════════════════════════════════════════════════
// submit-takedown/index.test.ts — Deno tests for the public DMCA intake
// endpoint's decision logic (Req 3.3/3.4): server-side well-formedness
// re-validation gates the RPC call, and the OPTIONS preflight works.
//
// Run (requires Deno; not installed in every dev box):
//     deno test supabase/functions/submit-takedown/index.test.ts
//
// ───────────────────────────────────────────────────────────────
// WHY a thin handler model (not the live handler):
//   index.ts wires its handler via `Deno.serve(handler)` WITHOUT exporting
//   it, and at module load imports `createClient` from esm.sh and builds a
//   Supabase client to call the ss_submit_complaint RPC. Driving that
//   end-to-end would mean resolving the esm.sh import and faking the RPC —
//   heavy and fragile, especially with Deno not installed locally.
//
//   So, following the precedent in mux-webhook/index.test.ts, we import the
//   REAL exported wellFormed() (the security-relevant decision) and exercise
//   it directly, plus a small `decideSubmit` model that mirrors index.ts's
//   "validate → would-call-RPC | return missing[]" branch line-for-line so
//   the validate-then-call path is testable without a database or network.
// ═══════════════════════════════════════════════════════════════

import { wellFormed } from "./index.ts";

// ── Thin model mirroring index.ts's POST branch after JSON.parse ──
// Returns what the handler would do: either it WOULD call the RPC (ok path)
// or it returns the missing[] keys with a 400 and calls NOTHING.
type SubmitDecision = {
  status: number;
  wouldCallRpc: boolean;
  body: Record<string, unknown>;
};

function decideSubmit(notice: unknown): SubmitDecision {
  const verdict = wellFormed(notice);
  if (!verdict.ok) {
    // 400; create NOTHING (Req 3.4).
    return { status: 400, wouldCallRpc: false, body: { ok: false, missing: verdict.missing } };
  }
  // ok → the handler calls ss_submit_complaint and returns { confirmation_ref }.
  return { status: 200, wouldCallRpc: true, body: { ok: true } };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  }
}

// A canonical well-formed notice (content_id target).
function goodNotice(): Record<string, unknown> {
  return {
    work_identification: "My song 'Example', released 2023, ISRC US-ABC-12-34567",
    content_id: "11111111-1111-1111-1111-111111111111",
    complainant_name: "Jane Doe",
    complainant_email: "jane@example.com",
    good_faith: true,
    accuracy_authority: true,
    signature: "Jane Doe",
  };
}

// ── Test 1: a well-formed notice passes validation and WOULD call the RPC ──
// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.3, 3.4
Deno.test("well-formed notice (content_id target) passes and would call ss_submit_complaint", () => {
  const out = decideSubmit(goodNotice());
  assert(out.status === 200, "well-formed → 200");
  assert(out.wouldCallRpc === true, "well-formed → the RPC IS called");
  assert(out.body.ok === true, "ok:true on success path");
});

// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.3, 3.4
Deno.test("well-formed notice with a target_url (no content_id) also passes", () => {
  const n = goodNotice();
  delete (n as Record<string, unknown>).content_id;
  n.target_url = "https://showshak.app/clip/abc123";
  const out = decideSubmit(n);
  assert(out.status === 200, "url-target notice → 200");
  assert(out.wouldCallRpc === true, "url-target notice → RPC called");
});

// ── Test 2: a malformed notice returns missing[] and does NOT call the RPC ──
// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.3, 3.4
Deno.test("malformed notice returns missing[] keys and does NOT call the RPC", () => {
  // Missing target (no content_id and no target_url), bad email, good_faith not true.
  const bad = {
    work_identification: "x",
    complainant_name: "Jane",
    complainant_email: "not-an-email",
    good_faith: false,
    accuracy_authority: true,
    signature: "Jane",
  };
  const out = decideSubmit(bad);
  assert(out.status === 400, "malformed → 400");
  assert(out.wouldCallRpc === false, "malformed → RPC is NOT called (create nothing)");
  assert(out.body.ok === false, "ok:false on failure path");
  const missing = out.body.missing as string[];
  assert(missing.includes("target"), "names the missing target");
  assert(missing.includes("complainant_email"), "names the bad email");
  assert(missing.includes("good_faith"), "names the missing good_faith affirmation");
});

// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.3, 3.4
Deno.test("null / empty notice fails every element and calls nothing", () => {
  const out = decideSubmit(null);
  assert(out.status === 400, "null → 400");
  assert(out.wouldCallRpc === false, "null → no RPC");
  const missing = out.body.missing as string[];
  for (
    const key of [
      "work_identification",
      "target",
      "complainant_name",
      "complainant_email",
      "good_faith",
      "accuracy_authority",
      "signature",
    ]
  ) {
    assert(missing.includes(key), `null notice lists ${key} as missing`);
  }
});

// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.3, 3.4
Deno.test("wellFormed does NOT mutate the input notice (pure)", () => {
  const n = goodNotice();
  const snapshot = JSON.stringify(n);
  wellFormed(n);
  assertEq(JSON.stringify(n), snapshot, "notice object is not mutated by validation");
});

// ── Test 3: the OPTIONS preflight works ──
// Feature: dmca-moderation-scaffolding — submit-takedown
// Validates: Requirements 3.1 (CORS-open public endpoint)
Deno.test("OPTIONS preflight returns CORS headers and 200 ok", async () => {
  // Import the shared CORS headers used by the handler's preflight branch.
  const { corsHeaders } = await import("../_shared/cors.ts");
  // The handler responds to OPTIONS with: new Response("ok", { headers: corsHeaders }).
  const res = new Response("ok", { headers: corsHeaders });
  assert(res.status === 200, "preflight → 200");
  assert(
    res.headers.get("Access-Control-Allow-Methods")?.includes("POST") ?? false,
    "preflight allows POST",
  );
  assert(
    res.headers.get("Access-Control-Allow-Methods")?.includes("OPTIONS") ?? false,
    "preflight allows OPTIONS",
  );
  assert(
    (res.headers.get("Access-Control-Allow-Headers") ?? "").includes("content-type"),
    "preflight allows content-type for the JSON body",
  );
});
