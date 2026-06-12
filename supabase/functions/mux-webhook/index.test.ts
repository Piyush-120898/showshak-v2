// ═══════════════════════════════════════════════════════════════
// mux-webhook/index.test.ts — Deno tests for the webhook's task-12.3
// decision logic: the duration backstop (Req 4.5/4.6) and the
// cover-time thumbnail on the live-flip (Req 8.2).
//
// Run (requires Deno; not installed in every dev box):
//     deno test supabase/functions/mux-webhook/index.test.ts
//
// ───────────────────────────────────────────────────────────────
// WHY A PURE MODEL (and not the real handler):
//   index.ts wires its handler via `Deno.serve(handler)` WITHOUT exporting
//   it, and at module load it imports `createClient` from esm.sh and
//   `muxFetch` from ../_shared/mux.ts, then builds a service-role Supabase
//   client and chains `.from('content').select(...).eq(...).update(...)`.
//   Driving that end-to-end would mean resolving the esm.sh import and
//   faking both the Supabase query-builder AND the Mux DELETE fetch — heavy
//   and fragile, especially with Deno not installed locally.
//
//   So we follow the precedent already set in
//   _shared/verify-signature.test.ts, which does NOT import the un-exported
//   handler: it re-expresses the webhook's core decision as a small PURE
//   MODEL (`applyReadyFlip`) and tests that. `applyWebhook` below mirrors
//   index.ts's task-12.3 logic EXACTLY (the DURATION_CAP const, the
//   Math.round duration, the over-cap delete + non-clobbering meta merge,
//   and the cover-time thumbnail URL) so the decision is testable without a
//   database or network. The constants/branches are copied line-for-line
//   from index.ts and must be kept in sync by hand (same posture as the
//   DURATION_CAP comment in index.ts itself).
// ═══════════════════════════════════════════════════════════════

// ── Pure model mirroring mux-webhook/index.ts (task 12.3) ──
// DURATION_CAP mirrors the const in index.ts.
const DURATION_CAP = 90;

type Meta = Record<string, any> | null;
type Row = { id: string; status: string; meta: Meta } | null;
type Asset = {
  id?: string | null;
  playback_ids?: { id: string }[];
  duration?: number;
  upload_id?: string | null;
};

type Outcome = {
  matched: boolean;
  muxDeleteCalledFor: string | null;
  dbWrite: Record<string, any> | null;
  response: Record<string, any>;
  status: number;
};

/* Mirrors index.ts after the row has been SELECTed:
     row  = the matched 'processing' row (or null when nothing matched)
     asset= event.data (the Mux asset payload) */
function applyWebhook(row: Row, asset: Asset): Outcome {
  // No match (unknown upload, or already live) → ACK, change nothing.
  if (row == null) {
    return {
      matched: false,
      muxDeleteCalledFor: null,
      dbWrite: null,
      response: { updated: 0 },
      status: 200,
    };
  }

  const durationSec: number | null = asset.duration ? Math.round(asset.duration) : null;

  // DURATION BACKSTOP (Req 4.5/4.6): over-cap asset is deleted + marked removed.
  if (durationSec !== null && durationSec > DURATION_CAP) {
    const muxDeleteCalledFor = asset.id ?? null;
    // Merge rejected_reason into EXISTING meta so other keys are preserved.
    const mergedMeta = { ...(row.meta || {}), rejected_reason: "over_duration_cap" };
    return {
      matched: true,
      muxDeleteCalledFor,
      dbWrite: {
        status: "removed",
        deleted_at: new Date().toISOString(),
        meta: mergedMeta,
      },
      response: { rejected: "over_duration_cap" },
      status: 200,
    };
  }

  // NORMAL live-flip. 0 is a valid cover time (first frame) → check finiteness.
  const playbackId: string | null = asset.playback_ids?.[0]?.id ?? null;
  const coverTime: number | null =
    row.meta && typeof row.meta.cover_time === "number" && isFinite(row.meta.cover_time)
      ? row.meta.cover_time
      : null;
  const thumbnailUrl: string | null = playbackId
    ? (coverTime !== null
      ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${coverTime}`
      : `https://image.mux.com/${playbackId}/thumbnail.jpg`)
    : null;

  return {
    matched: true,
    muxDeleteCalledFor: null,
    dbWrite: {
      status: "live",
      mux_asset_id: asset.id ?? null,
      mux_playback_id: playbackId,
      thumbnail_url: thumbnailUrl,
      duration_sec: durationSec,
    },
    response: { updated: 1 },
    status: 200,
  };
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  }
}

// ── Test 1: over-cap rejection + Math.round boundary ──
// Feature: curator-upload-v2 — mux-webhook
// Validates: Requirements 4.5, 4.6 (duration backstop) and 8.2 (cover-time thumbnail)
Deno.test("over-cap asset is deleted, marked removed, and preserves other meta", () => {
  const row = {
    id: "c1",
    status: "processing",
    meta: { mux_upload_id: "u1", vibes: ["x"], cover_time: 5 },
  };
  const asset = { id: "asset1", duration: 91, playback_ids: [{ id: "pb1" }] };

  const out = applyWebhook(row, asset);

  assert(out.muxDeleteCalledFor === "asset1", "DELETE the over-cap Mux asset");
  assert(out.dbWrite!.status === "removed", "row marked not-live (removed)");
  assert(out.dbWrite!.meta.rejected_reason === "over_duration_cap", "rejected_reason set");
  // Other meta keys are NOT clobbered by the merge.
  assert(out.dbWrite!.meta.mux_upload_id === "u1", "mux_upload_id preserved");
  assertEq(out.dbWrite!.meta.vibes, ["x"], "vibes preserved");
  assert(out.dbWrite!.meta.cover_time === 5, "cover_time preserved");
  assertEq(out.response, { rejected: "over_duration_cap" }, "rejection response");
  assert(out.status === 200, "ACK 200 so Mux does not retry");
  assert(typeof out.dbWrite!.deleted_at === "string", "deleted_at is an ISO string");
});

// Feature: curator-upload-v2 — mux-webhook
// Validates: Requirements 4.5, 4.6 (duration backstop) and 8.2 (cover-time thumbnail)
Deno.test("duration cap boundary follows Math.round semantics (90 ok, 90.4 ok, 90.6 rejected)", () => {
  const baseRow = { id: "c1", status: "processing", meta: { cover_time: 5 } };

  // Exactly 90 → NOT rejected (goes live).
  const exactly90 = applyWebhook(baseRow, { id: "a", duration: 90, playback_ids: [{ id: "pb" }] });
  assert(exactly90.muxDeleteCalledFor === null, "duration 90 is within cap");
  assert(exactly90.dbWrite!.status === "live", "duration 90 flips live");
  assert(exactly90.dbWrite!.duration_sec === 90, "duration_sec rounds to 90");

  // 90.4 rounds to 90 → NOT rejected.
  const round90 = applyWebhook(baseRow, { id: "a", duration: 90.4, playback_ids: [{ id: "pb" }] });
  assert(round90.muxDeleteCalledFor === null, "90.4 rounds to 90 (within cap)");
  assert(round90.dbWrite!.status === "live", "90.4 flips live");
  assert(round90.dbWrite!.duration_sec === 90, "90.4 -> 90");

  // 90.6 rounds to 91 → rejected.
  const round91 = applyWebhook(baseRow, { id: "a", duration: 90.6, playback_ids: [{ id: "pb" }] });
  assert(round91.muxDeleteCalledFor === "a", "90.6 rounds to 91 (over cap) -> delete");
  assert(round91.dbWrite!.status === "removed", "90.6 rejected");

  // A small sweep of durations confirms the > 90 (post-round) boundary.
  for (const d of [0, 1, 45, 89, 90, 90.49, 90.5, 91, 120]) {
    const out = applyWebhook(baseRow, { id: "a", duration: d, playback_ids: [{ id: "pb" }] });
    const rejected = Math.round(d) > 90;
    assert(
      (out.dbWrite!.status === "removed") === rejected,
      `duration ${d}: rejected expected ${rejected}`,
    );
  }
});

// ── Test 2: cover-time thumbnail on the live-flip ──
// Feature: curator-upload-v2 — mux-webhook
// Validates: Requirements 4.5, 4.6 (duration backstop) and 8.2 (cover-time thumbnail)
Deno.test("within-cap asset flips live and applies meta.cover_time to the thumbnail URL", () => {
  // cover_time = 5 → URL ends with ?time=5
  const withCover = applyWebhook(
    { id: "c1", status: "processing", meta: { cover_time: 5 } },
    { id: "asset1", duration: 30, playback_ids: [{ id: "pb1" }] },
  );
  assert(withCover.dbWrite!.status === "live", "flips live");
  assert(withCover.muxDeleteCalledFor === null, "no Mux delete on a within-cap asset");
  assert(withCover.dbWrite!.mux_playback_id === "pb1", "playback id stored");
  assert(withCover.dbWrite!.duration_sec === 30, "duration_sec stored");
  assert(
    withCover.dbWrite!.thumbnail_url === "https://image.mux.com/pb1/thumbnail.jpg?time=5",
    "cover_time applied to thumbnail",
  );
  assertEq(withCover.response, { updated: 1 }, "updated response");

  // No cover_time → default thumbnail (no ?time).
  const noCover = applyWebhook(
    { id: "c2", status: "processing", meta: { mux_upload_id: "u2" } },
    { id: "asset2", duration: 30, playback_ids: [{ id: "pb2" }] },
  );
  assert(
    noCover.dbWrite!.thumbnail_url === "https://image.mux.com/pb2/thumbnail.jpg",
    "default thumbnail has no ?time",
  );
  assert(!noCover.dbWrite!.thumbnail_url.includes("?time"), "no time parameter when absent");

  // cover_time = 0 is valid (first frame) → ?time=0
  const zeroCover = applyWebhook(
    { id: "c3", status: "processing", meta: { cover_time: 0 } },
    { id: "asset3", duration: 30, playback_ids: [{ id: "pb3" }] },
  );
  assert(
    zeroCover.dbWrite!.thumbnail_url === "https://image.mux.com/pb3/thumbnail.jpg?time=0",
    "cover_time 0 produces ?time=0",
  );
});

// ── Test 3: idempotency / no match ──
// Feature: curator-upload-v2 — mux-webhook
// Validates: Requirements 4.5, 4.6 (duration backstop) and 8.2 (cover-time thumbnail)
Deno.test("no matching processing row → ACK 200, no db write, no Mux delete", () => {
  const out = applyWebhook(null, { id: "asset1", duration: 30, playback_ids: [{ id: "pb1" }] });
  assert(out.matched === false, "no row matched");
  assertEq(out.response, { updated: 0 }, "updated:0 response");
  assert(out.status === 200, "ACK 200 so Mux does not retry a handled/unknown event");
  assert(out.dbWrite === null, "no db write");
  assert(out.muxDeleteCalledFor === null, "no Mux delete");
});
