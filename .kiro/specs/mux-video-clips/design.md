# Design Document

## Overview

This feature replaces ShowShak's mock clip media with real short-form video delivered through Mux, played by the `<mux-player>` web component, behind the **existing** `MediaSurfaceContract`. It is deliberately small in surface area: the clip engine (`ClipEngine`, `ssCreateSurface`, `ssMakeProgressBar`, `ssAttachGestures`, `ssClipOrdering`) already speaks a clean contract and **already branches in exactly one place** — `ssCreateSurface(clip, opts)` — on `clip.muxPlaybackId`. Today that branch returns `GradientSurface`; the unimplemented `VideoSurface()` is the only missing primitive. The bulk of this design is therefore:

1. **Build `VideoSurface`** as a faithful `MediaSurfaceContract` implementation wrapping `<mux-player>`, so `ssCreateSurface` works with zero new engine branching.
2. **Teach `ssLoadClips` to carry the Mux fields** (`mux_playback_id`, `url`, `thumbnail_url`, `duration_sec`) and map `muxPlaybackId` + `poster` onto the clip; carry them through `ssClipsForFeed` / `ssClipsForDiscover`.
3. **Stand up the first two Supabase Edge Functions** (`mux-upload-url`, `mux-webhook`) so a curator can upload directly to Mux and a webhook flips the row to `live`.
4. **Make the upload flow's `publish()` real** — direct-to-Mux upload with progress, then a `content` row insert in `processing`.
5. **Add windowed + sliding-window preloading** around the feed without touching engine internals.
6. **Load `<mux-player>` via CDN** on feed-bearing pages.

The `content` table already carries every column we need (`mux_asset_id`, `mux_playback_id`, `thumbnail_url`, `url`, `duration_sec`, `status default 'processing'`), so the database work is small and **additive** (one RLS insert policy + a grant + demo/seed tagging convention), applied directly per `supabase/SCHEMA_CHANGE_PROCESS.md`. No risky/destructive change is required.

Everything stays vanilla JS / HTML / CSS, zero frameworks, zero build tools. Mux secrets live only in Edge Function secrets; the browser keeps the anon key only.

### Standing principles honored

- **Build for today, structure for tomorrow** — `<mux-player>` is a standards-based custom element that plays HLS; the same component and the same `MediaSurfaceContract` carry forward to a native wrapper / future app (see "PWA-now, native-later").
- **Counts are derived** — untouched; this feature never writes a `*_count`.
- **RLS is the lock** — content insert is gated by an RLS policy keyed to `auth.uid()`; the webhook writes with the service role server-side only.
- **Additive-direct / risky-staged** — only additive changes here; applied directly after review.
- **Secrets server-side, anon key frontend** — Mux token id/secret and the Supabase service-role key live only in Edge Function secrets, mirroring the `data/.env` precedent in `ingest-tmdb.js`.
- **Feed UX is the constant frame** — inline autoplay, single-tap opens fullscreen, no show title on the clip body, and the Fire / Save / Share / Watch It rail stays present. None of these change; `VideoSurface` simply replaces the gradient medium behind them.

---

## Architecture

### Full pipeline (upload → process → play)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  BROWSER  (anon key only — no Mux/service-role secret ever reaches here)       │
│                                                                                │
│  showshak-upload.html (curator, authenticated)                                 │
│    Step 1 file pick ─┐                                                         │
│    Steps 2–5 metadata│                                                         │
│         publish() ───┼──(1) POST /functions/v1/mux-upload-url  (user JWT)      │
│                      │        ◄── { uploadUrl, uploadId }                      │
│                      │                                                         │
│                      ├──(2) PUT file bytes ───────────────► Mux Direct Upload  │
│                      │        (progress events shown)         (bytes never     │
│                      │                                          touch Supabase) │
│                      │                                                         │
│                      └──(3) INSERT content row (anon key + user JWT, RLS)      │
│                               { creator_id=auth.uid(), title_id, platform_id,  │
│                                 description, mux_upload_id, status='processing'}│
│                                                                                │
│  showshak-feed.html (viewer, guest or auth)                                    │
│    ssLoadClips() ──(6) SELECT … status='live' ──► feed window of ~10           │
│    ClipEngine.mountInline → ssCreateSurface → VideoSurface(<mux-player>)        │
└──────────────────────────────────────────────────────────────────────────────┘
        │ (1)(3)(6) Supabase (Postgres, Mumbai) + Edge Functions (Deno)          
        ▼                                                                        
┌──────────────────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                                      │
│                                                                                │
│  Edge Function: mux-upload-url   (auth-gated)                                  │
│    • verify caller JWT (must be authenticated curator)                         │
│    • read MUX_TOKEN_ID / MUX_TOKEN_SECRET from function secrets                │
│    • POST Mux /video/uploads (new_asset_settings, cors_origin)                 │
│    • return { uploadUrl, uploadId }   (never returns the Mux secret)           │
│                                                                                │
│  content table: row inserted with status='processing'                          │
│                                                                                │
│  Edge Function: mux-webhook      (public URL, signature-verified)              │
│    ◄──(4) Mux POST video.asset.ready  (Mux-Signature header)                   │
│    • verify Mux-Signature (timestamp + HMAC-SHA256 of body)                    │
│    • resolve content row by upload_id → asset_id                               │
│    • (5) UPDATE status='live', mux_asset_id, mux_playback_id,                   │
│           thumbnail_url, duration_sec   (service role, idempotent)             │
│    • 200 OK (even when no row matches — acknowledge & ignore)                   │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲                                                                        
        │ (4) webhook              (2) direct upload bytes                       
        ▼                                  ▲                                     
┌──────────────────────────────────────────────────────────────────────────────┐
│  MUX  — ingests the upload, encodes to HLS, emits video.asset.ready            │
│         playback via https://stream.mux.com/{playbackId}.m3u8                  │
│         poster   via https://image.mux.com/{playbackId}/thumbnail.jpg          │
└──────────────────────────────────────────────────────────────────────────────┘
```

The numbered steps (1)–(6) are the only new data flows. Steps (1)(2)(3) are the upload path; (4)(5) are the webhook path; (6) is the unchanged-shape read path that now also carries Mux fields.

## Components and Interfaces

### Component inventory

| Component | File | Status |
|---|---|---|
| `VideoSurface(clip, opts)` | `showshak-shared.js` | **new** — the one missing primitive |
| `ssCreateSurface` branch | `showshak-shared.js` | exists; now both arms implemented |
| `ssLoadClips` select + map | `showshak-shared.js` | **edit** — add Mux columns + `muxPlaybackId`/`poster` |
| `ssClipsForFeed` / `ssClipsForDiscover` | `showshak-shared.js` | **edit** — carry `muxPlaybackId`/`poster` through |
| Sliding-window preloader | `showshak-shared.js` (feed-facing helper) + `showshak-feed.html` init | **new** — wraps `ssLoadClips`, feeds `mountInline` |
| `<mux-player>` CDN script | feed-bearing pages | **new** `<script>` include |
| `mux-upload-url` Edge Function | `supabase/functions/mux-upload-url/` | **new** |
| `mux-webhook` Edge Function | `supabase/functions/mux-webhook/` | **new** |
| Real `publish()` | `showshak-upload.html` | **edit** — direct upload + insert |
| Content insert RLS + grant | `supabase/migrations/0012_content_insert_and_mux.sql` | **new, additive** |

---

## Supabase Edge Functions (Deno)

These are the **first** Edge Functions in the project. The repo's server-side secret precedent is `data/ingest-tmdb.js` (service-role key + TMDB key in git-ignored `data/.env`, run manually by the founder). Edge Functions follow the same philosophy but store secrets in **Supabase function secrets** (set once via dashboard/CLI), not a local file, because they run on Supabase's infrastructure.

### Directory structure

```
supabase/
  functions/
    _shared/
      cors.ts            # shared CORS headers (allow app origin)
      mux.ts             # tiny Mux REST helpers (Basic auth from secrets)
    mux-upload-url/
      index.ts           # auth-gated: mint a Mux direct-upload URL
    mux-webhook/
      index.ts           # signature-verified: flip status → live
  migrations/
    0012_content_insert_and_mux.sql
```

### Secrets (set once, founder-only)

Stored as Supabase function secrets — never in the repo, never shipped to the browser:

- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` — Mux API Basic-auth credentials (the `Mux_Secret`).
- `MUX_WEBHOOK_SECRET` — the signing secret for the Mux webhook endpoint.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — injected automatically by the Supabase runtime; the webhook uses the service role to bypass RLS for the status flip.
- `APP_ORIGIN` — the deployed app origin, used for CORS allow-list and Mux `cors_origin`.

Founder-only deploy steps (dashboard or CLI), documented for whoever ships it:

```
# one-time
supabase functions deploy mux-upload-url
supabase functions deploy mux-webhook --no-verify-jwt   # webhook is public; it verifies Mux's own signature
supabase secrets set MUX_TOKEN_ID=... MUX_TOKEN_SECRET=... MUX_WEBHOOK_SECRET=... APP_ORIGIN=https://<app>
# then in the Mux dashboard: add the webhook URL (…/functions/v1/mux-webhook) and copy its signing secret
```

`mux-upload-url` keeps JWT verification ON (Supabase verifies the caller's auth token before the function runs, and the function double-checks). `mux-webhook` runs with `--no-verify-jwt` because Mux is not a Supabase user — it authenticates by signing the request body, which the function verifies itself.

### `mux-upload-url` — mint a direct-upload URL (auth-gated)

Responsibilities (Req 1.1, 1.2, 1.3, 11.3):

- **Auth check**: read the `Authorization: Bearer <jwt>` header, resolve the user via the Supabase client bound to that token. If there is no authenticated user, return `401` and mint nothing.
- **Mint**: call Mux `POST https://api.mux.com/video/uploads` with Basic auth built from `MUX_TOKEN_ID:MUX_TOKEN_SECRET`, body `{ new_asset_settings: { playback_policy: ["public"] }, cors_origin: APP_ORIGIN }`.
- **Return**: only `{ uploadUrl, uploadId }`. The secret is never serialized into the response.

```ts
// supabase/functions/mux-upload-url/index.ts  (Deno)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) AUTH GATE — must be an authenticated user (Req 1.3 / 11.3)
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 2) MINT via Mux (secret read ONLY from function secrets — Req 1.2)
  const basic = btoa(`${Deno.env.get("MUX_TOKEN_ID")}:${Deno.env.get("MUX_TOKEN_SECRET")}`);
  const muxRes = await fetch("https://api.mux.com/video/uploads", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      new_asset_settings: { playback_policy: ["public"] },
      cors_origin: Deno.env.get("APP_ORIGIN") ?? "*",
    }),
  });
  if (!muxRes.ok) {
    return new Response(JSON.stringify({ error: "mux_upload_create_failed" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { data } = await muxRes.json();   // { data: { id, url, ... } }

  // 3) RETURN only the upload URL + id (NEVER the Mux secret — Req 1.2)
  return new Response(JSON.stringify({ uploadUrl: data.url, uploadId: data.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

### `mux-webhook` — verify, then flip to live (idempotent, service role)

Responsibilities (Req 3.1–3.6):

- **Signature verification** (Req 3.3): Mux sends `Mux-Signature: t=<ts>,v1=<hex>`. Recompute `HMAC-SHA256(MUX_WEBHOOK_SECRET, "<ts>.<rawBody>")` and constant-time compare with `v1`; reject mismatches and stale timestamps with `401`/`403` and modify nothing.
- **Match** (Req 3.4): only handle `type === "video.asset.ready"`. Resolve the `content` row by the asset's `upload_id` (stored at insert time as `mux_upload_id`), falling back to `mux_asset_id`. If no row matches, return `200` and modify nothing.
- **Idempotent flip** (Req 3.1, 3.2, 3.5): set `status='live'`, `mux_asset_id`, `mux_playback_id`, `thumbnail_url` (Mux image CDN URL), `duration_sec`. Guard the update with `…neq('status','live')` (or update only when currently `processing`) so a duplicate ready event leaves an already-live row unchanged.
- **Server-side credentials** (Req 3.6): use a service-role client; the service-role key never leaves the function.

```ts
// supabase/functions/mux-webhook/index.ts  (Deno)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enc = new TextEncoder();

async function verifyMuxSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const ts = parts["t"]; const sig = parts["v1"];
  if (!ts || !sig) return false;
  // reject stale events (replay protection): 5-minute tolerance
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const raw = await req.text();                                  // raw body for HMAC
  const ok = await verifyMuxSignature(raw, req.headers.get("Mux-Signature") ?? "",
    Deno.env.get("MUX_WEBHOOK_SECRET")!);
  if (!ok) return new Response("bad signature", { status: 401 });  // Req 3.3 — modify nothing

  const event = JSON.parse(raw);
  if (event.type !== "video.asset.ready") return new Response("ignored", { status: 200 });

  const asset = event.data;
  const uploadId = asset.upload_id ?? null;
  const playbackId = asset.playback_ids?.[0]?.id ?? null;
  const durationSec = asset.duration ? Math.round(asset.duration) : null;
  const thumbnailUrl = playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });

  // Idempotent flip: only rows still processing for this upload are touched (Req 3.5).
  const { data: updated } = await db.from("content")
    .update({ status: "live", mux_asset_id: asset.id, mux_playback_id: playbackId,
              thumbnail_url: thumbnailUrl, duration_sec: durationSec })
    .eq("mux_upload_id", uploadId).eq("status", "processing").select("id");

  // No match (unknown upload, or already live) → acknowledge, change nothing (Req 3.4/3.5).
  return new Response(JSON.stringify({ updated: updated?.length ?? 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } });
});
```

> `mux_upload_id` is the upload identifier returned by `mux-upload-url` and stored on the content row at insert time. Mux's `video.asset.ready` event includes `upload_id`, which is what lets the webhook find the right row before any `mux_asset_id` exists. We store `mux_upload_id` in `content.meta` (no new column needed) to keep the DB change minimal; see Data Model.

---

## VideoSurface — the one missing primitive

`VideoSurface(clip, opts)` returns an object implementing the full `MediaSurfaceContract`, wrapping a `<mux-player>` element. `<mux-player>` exposes a media-like API (it behaves like an `HTMLMediaElement`: `play()`, `pause()`, `.muted`, `.currentTime`, `.duration`, and `timeupdate`/`loadedmetadata`/`ended`/`playing` events), so the mapping is one-to-one and the engine never learns it exists.

### Contract → mux-player mapping

| Contract method | mux-player implementation |
|---|---|
| `mount(container)` | create `<mux-player>`, set `playback-id`, `muted`, `playsinline`, `poster`, `loop=false`; append to container; return the node (Req 6.2) |
| `play()` | `el.play()` → returns the play Promise (Req 6.3) |
| `pause()` | `el.pause()` (Req 6.3) |
| `setMuted(m)` | `el.muted = !!m` (Req 6.4) |
| `isMuted()` | `return !!el.muted` (Req 6.4) |
| `getProgress()` | `duration ? clamp(currentTime / duration, 0, 1) : 0` (Req 5.4, 6.5) |
| `seek(f)` | `if (duration) el.currentTime = clamp(f,0,1) * duration` (Req 5.5) |
| `onTimeupdate(cb)` | push `cb`; fire on `timeupdate` with current progress (Req 5.6, 6.5) |
| `onEnded(cb)` | push `cb`; fire on the `ended` media event (Req 5.7, 6.6) |
| `destroy()` | remove media listeners, detach the element from the DOM (Req 5.8) |

### Loading / poster state (Req 7)

- On mount, set the player `poster` to the clip's Mux image-CDN thumbnail: `https://image.mux.com/{playbackId}/thumbnail.jpg` (Req 7.2). `mux-player` shows the poster until frames render and removes it once playback starts (Req 7.1, 7.3).
- If the clip has **no** `poster`/`thumbnail_url`, paint the clip's gradient (`clip.bg`) as the mount-point background behind the player, so the loading state is the gradient rather than a blank frame (Req 7.4).
- If the player emits `error` (HLS/network failure), keep the poster visible and let `onEnded` advance the feed so playback isn't stuck (Req 12.4). We treat a load error like an early "ended" after a short grace period so the engine moves on.

```js
/**
 * VideoSurface — the Mux Media_Surface. Wraps a <mux-player> custom element
 * and maps the HTMLMediaElement-like API to the MediaSurfaceContract. The
 * engine NEVER branches on this type; ssCreateSurface returns it whenever a
 * clip has a muxPlaybackId.
 */
function VideoSurface(clip, opts) {
  var el = null, ended = false;
  var onTick = [], onEnd = [];
  var _muted = true, _errored = false;

  function progress() {
    var d = el && el.duration;
    return (d && isFinite(d) && d > 0) ? Math.max(0, Math.min(1, el.currentTime / d)) : 0;
  }
  function handleTimeupdate() { var p = progress(); onTick.forEach(function (cb) { cb(p); }); }
  function handleEnded()      { ended = true; onEnd.forEach(function (cb) { cb(); }); }
  function handleError() {
    // Player failed to load video (Req 12.4): keep poster, let the engine advance.
    _errored = true;
    setTimeout(function () { if (!ended) handleEnded(); }, 600);
  }

  return {
    mount: function (container) {
      el = document.createElement('mux-player');
      el.setAttribute('playback-id', clip.muxPlaybackId);
      el.setAttribute('stream-type', 'on-demand');
      el.setAttribute('playsinline', '');
      el.muted = _muted;
      // Poster from Mux image CDN, else gradient loading state (Req 7.2 / 7.4).
      if (clip.poster) el.setAttribute('poster', clip.poster);
      else container.style.background = clip.bg || '#000';
      // Visuals match GradientSurface's mount node so feed CSS is unchanged.
      el.className = (opts && opts.bgClass) || 'clip-bg';
      el.style.width = '100%'; el.style.height = '100%';
      el.addEventListener('timeupdate', handleTimeupdate);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('error', handleError);
      container.appendChild(el);
      return el;
    },
    play: function () { return el ? (el.play() || Promise.resolve()) : Promise.resolve(); },
    pause: function () { if (el) el.pause(); },
    setMuted: function (m) { _muted = !!m; if (el) el.muted = _muted; },
    isMuted: function () { return el ? !!el.muted : _muted; },
    getProgress: function () { return progress(); },
    seek: function (f) {
      if (!el) return;
      var d = el.duration;
      if (d && isFinite(d)) el.currentTime = Math.max(0, Math.min(1, f)) * d;
    },
    onTimeupdate: function (cb) { onTick.push(cb); },
    onEnded: function (cb) { onEnd.push(cb); },
    destroy: function () {
      if (el) {
        el.removeEventListener('timeupdate', handleTimeupdate);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('error', handleError);
        try { el.pause(); } catch (e) {}
        el.remove();
      }
      el = null; onTick = []; onEnd = [];
    },
  };
}
```

### Zero engine branching

`ssCreateSurface` is unchanged in shape — the future-seam comment simply becomes reality:

```js
function ssCreateSurface(clip, opts) {
  return (clip && clip.muxPlaybackId)
    ? VideoSurface(clip, opts)      // now implemented
    : GradientSurface(clip, opts);  // fallback (Req 5.3, 10.1)
}
```

Because both surfaces satisfy the same contract, `ClipEngine.mountInline` / `ssOpenClip` / `setActive` / `togglePause` / the progress bar wiring / `ssAttachGestures` / the `ssOnMuteChange` re-apply all work identically for video and gradient clips (Req 5.9, 10.2, 10.3). A feed mixing video-backed and gradient-backed clips loops continuously through both (Req 8, 10.3). The first-clip muted-autoplay lock and the persisted `Mute_Preference` (`ss_mute_pref_v1`) apply to `VideoSurface` exactly as they do to `GradientSurface`, since both implement `setMuted`/`isMuted` (Req 6.4).

---

## Clip loader changes (`ssLoadClips`)

Two edits, both additive to the existing mapping:

1. **Select the Mux columns** the loader currently omits:

```js
// before: .select("id, description, fires_count, meta, status, creator:…, title:…, platform:…")
// after — add the four Mux fields (Req 4.1):
.select("id, description, fires_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
```

2. **Map `muxPlaybackId` + `poster`** in the row→clip projection (Req 4.2, 4.4):

```js
return {
  id: row.id,
  // … existing fields …
  muxPlaybackId: row.mux_playback_id || null,   // null → GradientSurface (Req 4.4, 10.1)
  poster: row.thumbnail_url || null,            // Mux image-CDN URL (Req 7.2); null → gradient loading (Req 7.4)
  url: row.url || null,
  durationSec: row.duration_sec || null,
  // … bg, platLabel, creator, etc unchanged …
};
```

The existing filter `.eq("status","live").is("deleted_at",null)` already satisfies Req 4.3, 2.3 (processing excluded), and 12.3 (removed excluded). No change there.

The feed/discover projections must **carry the new fields through** (today `ssClipsForFeed` and `ssClipsForDiscover` re-shape the clip and would drop `muxPlaybackId`):

```js
// ssClipsForFeed(base): add to each mapped object →   muxPlaybackId:c.muxPlaybackId, poster:c.poster,
// ssClipsForDiscover(base): same addition.
```

This is the critical wiring detail — `ssCreateSurface` reads `clip.muxPlaybackId`, and the feed passes the `ssClipsForFeed`-shaped objects into `mountInline`, so the field must survive that projection.

---

## Windowed + sliding-window preloading

### Where it lives

Ordering is owned by the `Recommendation_Seam` (`ssClipOrdering` → `_ssvBuildList`) and the engine renders whatever array it's handed. Preloading is a **feed-level concern**, not an engine concern, so it lives in a small loader/pager helper that sits *above* `mountInline` and *beside* `ssLoadClips` — it never touches `_ssvBuildList` or `ClipEngine` internals. The engine keeps rendering an array; the pager grows that array and asks the engine to append.

### Model

- **Initial window** (Req 9.1): `ssLoadClips` fetches ~10 clips (page size `SS_CLIP_WINDOW = 10`) using `.range(offset, offset+9)` ordered by `created_at desc`, instead of a flat `limit(50)`.
- **Preload within the window** (Req 9.2): `<mux-player>` defaults to lazy buffering. For the active clip plus a small look-ahead (the next 1–2), set `preload="auto"`; for clips outside that band set `preload="none"`. This makes the next clips start instantly on scroll without buffering all ten.
- **Sliding fetch** (Req 9.3): the feed's `IntersectionObserver` already reports the active index (`_inlineActiveIdx`). When the active index reaches `windowStart + 6` and another page may exist, call `loadNextWindow()` once (guarded by an in-flight flag so it fires a single time per window).
- **Seamless append** (Req 9.4): `loadNextWindow()` fetches the next `.range()` page, maps via `ssClipsForFeed`, appends the new frames' DOM + builds their surfaces/bars/gestures (the same per-clip wiring `mountInline` already does in its `forEach`), and appends to `_inlineClips`. No reset, no scroll jump — playback continues.
- **Bounded concurrency** (Req 9.5): cap the number of *materialized* `VideoSurface` players. Keep a sliding band of mounted players around the active index (e.g. active −1 … active +2); clips that scroll far above the active index have their surface `destroy()`-ed (releasing the `<mux-player>` and its buffer) and are re-mounted if the viewer scrolls back. This bounds concurrent video elements regardless of how many windows have been appended.

```js
// Feed-level pager (lives near ssLoadClips; calls into the engine's public surface only).
var SS_CLIP_WINDOW = 10;          // ~10 per window (Req 9.1/9.3)
var SS_PRELOAD_AHEAD = 2;         // look-ahead band for preload="auto" (Req 9.2)
var SS_MAX_LIVE_PLAYERS = 4;      // bound on concurrent mounted players (Req 9.5)

async function ssLoadClipWindow(offset) {            // one page (Req 9.1)
  var base = await ssLoadClips(SS_CLIP_WINDOW, offset);  // ssLoadClips gains an offset arg → .range()
  return ssClipsForFeed(base);
}
// loadNextWindow(): fired by the observer at windowStart+6 (Req 9.3), appends seamlessly (Req 9.4),
// and prunes far-offscreen players to respect SS_MAX_LIVE_PLAYERS (Req 9.5).
```

> `ssLoadClips` gains an optional `offset` parameter and switches from `.limit(n)` to `.range(offset, offset + n - 1)`; existing callers that pass only a limit keep working (offset defaults to 0).

This is the one place that requires a small, additive extension to `ClipEngine`/`mountInline` (an "append clips" entry point and a "prune offscreen surfaces" step). It is designed as a thin addition that reuses the exact per-clip wiring already in `mountInline`'s `forEach`, so the engine's contract-only discipline is preserved.

---

## Real upload `publish()` (showshak-upload.html)

The 5-step wizard, validation, and review UI are unchanged. Only the file step and `publish()` change from mock to real.

### File step

`upHandleFile` keeps the local `URL.createObjectURL` preview (instant, no upload yet). The actual byte upload happens at publish so a curator can still back out during steps 2–5 without burning a Mux upload.

### `publish()` flow (Req 1.4, 1.5, 2.1, 12.1)

1. **Guard**: require an authenticated curator (`ssCurrentUser()`); guests are sent to the sign-in funnel (Req 11.3). No upload URL is minted for them.
2. **Mint**: `POST` to `mux-upload-url` with the user's access token; receive `{ uploadUrl, uploadId }`.
3. **Direct upload with progress** (Req 1.4, 1.5): `PUT` the file bytes straight to `uploadUrl` using `XMLHttpRequest` (chosen over `fetch` because it exposes `upload.onprogress`). Bytes go browser→Mux and never touch Supabase. Drive the existing top progress pip / a publish progress UI from `e.loaded / e.total`.
4. **Insert content row** (Req 2.1, 2.5): on upload success, `INSERT` into `content` via `window.ssDB` (anon key + the curator's JWT, so the RLS insert policy passes): `{ creator_id: me.id, title_id, platform_id, description: pitch, status: 'processing', meta: { mux_upload_id: uploadId, vibes, lang, season, bg } }`. The clip is **not** marked published/live by the client — only the webhook flips it to `live`.
5. **Draft/processing UX** (Req 2.2, 12.2): the success screen says "processing — it'll go live once Mux finishes," and the profile "My Clips" tab shows the row with a *Processing* badge while `status='processing'`. Because the feed loader only returns `live`, the clip stays out of the feed until ready (Req 2.3).
6. **Failure** (Req 12.1, 12.5): if the mint call, the `PUT`, or the insert fails, report the error to the curator and do **not** show the published/live success state. A failed mint or unreachable function aborts cleanly with no content row; a failed upload after a row was *not yet* inserted leaves no orphan. (We insert only after the bytes land, so a mid-upload failure corrupts nothing.)

```js
async function publish() {
  var me = (typeof ssCurrentUser === 'function') ? ssCurrentUser() : null;
  if (!me) { /* funnel to sign-in (Req 11.3) */ return; }

  // 1) mint (auth-gated edge function) — Req 1.1
  var tok = (await window.ssDB.auth.getSession()).data.session.access_token;
  var mint = await fetch(SS_FUNCTIONS_URL + '/mux-upload-url', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok },
  });
  if (!mint.ok) { ssToast('Upload could not start — try again'); return; }   // Req 12.1/12.5
  var up = await mint.json();   // { uploadUrl, uploadId }

  // 2) direct-to-Mux PUT with progress — Req 1.4 / 1.5
  await ssPutWithProgress(up.uploadUrl, draft.file, function (pct) { setPublishProgress(pct); })
    .catch(function () { ssToast('Upload failed'); throw 0; });             // Req 12.1

  // 3) insert content row as processing (RLS: creator_id = auth.uid()) — Req 2.1/2.5
  var ins = await window.ssDB.from('content').insert({
    creator_id: me.id, title_id: draft.show.titleId || null,
    platform_id: draft.show.platformId || null, description: draft.pitch, status: 'processing',
    meta: { mux_upload_id: up.uploadId, vibes: draft.vibes, lang: draft.show.lang, bg: draft.show.bg },
  });
  if (ins.error) { ssToast('Could not save your clip'); return; }           // Req 12.5

  showProcessingSuccess();   // "processing → goes live automatically" (Req 2.2/12.2)
}
```

> The upload step needs the file object, so `draft.file` is retained alongside `draft.videoUrl`. The show step must resolve a real `title_id`/`platform_id`; in the prototype the catalog is local, so until TMDB-backed title rows exist the insert may pass `title_id: null` (the schema allows it). This keeps the pipeline working end-to-end today and improves as `titles` fills in.

---

## mux-player CDN loading

Add the web component via CDN `<script>` on every feed-bearing page — the feed (`showshak-feed.html`) and any page that opens the fullscreen clip viewer (which is injected app-wide through `showshak-shared.js`), i.e. discover, watchlist, profile (Req 6.1):

```html
<script src="https://cdn.jsdelivr.net/npm/@mux/mux-player"></script>
```

Placed alongside the existing CDN includes (the Supabase library is already loaded the same way). It defines the `<mux-player>` custom element globally; `VideoSurface.mount` then just creates the element. Loading order doesn't gate the engine — if a video clip mounts before the element upgrades, the custom element upgrades in place when the script arrives; gradient clips are unaffected. For resilience, pin a version in production.

---

## Data Models

The `content` table already has `mux_asset_id`, `mux_playback_id`, `thumbnail_url`, `url`, `duration_sec`, and `status default 'processing'`. So the only changes are **additive** and applied directly per `SCHEMA_CHANGE_PROCESS.md` (new policy, new grant — both on the SAFE list):

`supabase/migrations/0012_content_insert_and_mux.sql`:

- **Grant + RLS insert policy** so a curator can insert their own content (Req 2.5, 11.3):

```sql
grant insert on table public.content to authenticated;
alter table public.content enable row level security;
drop policy if exists content_insert_own on public.content;
create policy content_insert_own on public.content
  for insert with check (creator_id = auth.uid());
-- public live reads remain as already granted (feed reads status='live').
```

- **`mux_upload_id` storage**: stored inside the existing `content.meta jsonb` (the schema's "future fields without migrations" convention), so **no new column** is needed. The webhook matches on it via `meta->>'mux_upload_id'`. (If a first-class column is later wanted for indexing, adding a nullable `mux_upload_id text` column is itself an additive change.)

> Matching note: the webhook example uses `.eq("mux_upload_id", …)` for readability; the actual query targets the meta key, e.g. `.eq("meta->>mux_upload_id", uploadId)`, or a generated/added nullable column if we choose to promote it. Either is additive.

- **Demo/seed tagging** (Req 2.6): real uploads carry no seed marker; demo/seed rows continue to set `meta.seed = true` exactly as `0007_seed_demo_content.sql` does, so `RESET_demo_data.sql` can still wipe them. Any new seeded Mux-backed demo clips follow the same `meta.seed=true` convention.

- **`status` lifecycle** (Req 2.2): the allowed values remain `draft | processing | live | removed`. We rely on application/Edge-Function discipline for transitions (insert→`processing`, webhook→`live`, moderation→`removed`). A CHECK constraint on `status` would be a *risky* change on a populated table and is therefore out of scope for this additive pass; it can be staged later per the process doc.

RLS for the webhook: the webhook uses the **service role**, which bypasses RLS (per `0011_grant_service_role.sql`), so no extra update policy is required for it; the service-role key stays server-side only (Req 3.6).

---

## Error Handling

| Case | Handling | Req |
|---|---|---|
| Upload fails before completion | `ssPutWithProgress` rejects → toast error, no `live` state, no published success; row inserted only after bytes land so no orphan | 12.1 |
| Mint / function unreachable | `fetch` non-OK or network error → abort with toast, mint nothing, insert nothing → no row corruption | 12.5 |
| Insert fails | toast error; the Mux asset will process but no row references it (harmless dangling asset; can be reaped later) | 12.5 |
| Processing stuck past timeout | Feed keeps excluding `processing` rows (loader filters `live`); profile "My Clips" shows a *Processing* badge with elapsed time so the curator sees it's still working | 12.2, 2.3 |
| Clip removed | `status='removed'` (or `deleted_at` set) → loader's `status='live'` + `deleted_at is null` filter excludes it | 12.3 |
| Player fails to load a live clip | `VideoSurface` keeps the poster visible and synthesizes an `ended` after a short grace so `ClipEngine` advances to the next clip; the feed doesn't stall | 12.4 |
| Webhook can't match the event | Signature verified, but no row for the upload → return `200`, modify nothing | 3.4 |
| Duplicate ready event | Update guarded by `status='processing'` → already-live row untouched | 3.5 |
| Bad/forged webhook signature | `401`, modify nothing | 3.3 |

---

## PWA-now, native-app-later

- **`<mux-player>` is a framework-agnostic Web Component** built on standard `HTMLMediaElement` semantics and HLS. It runs in today's static PWA with a single CDN `<script>` and no build step, and the same component drops into any future WebView-based native shell unchanged.
- **HLS carries forward**: Mux serves adaptive HLS (`stream.mux.com/{id}.m3u8`). A future native app can either keep `<mux-player>` in a WebView or swap to a native AVPlayer/ExoPlayer fed the *same* Mux playback id — because the playback id is the portable contract, not the player widget.
- **The `MediaSurfaceContract` is the real seam**: native playback would be just another `MediaSurfaceContract` implementation selected in `ssCreateSurface`. The engine, gestures, progress bar, mute model, and ordering seam are all medium-agnostic, so the migration cost is bounded to one factory branch.
- **Server-side minting and webhooks are platform-neutral**: the Edge Functions are HTTP endpoints; a native client calls the same `mux-upload-url` and the same webhook fires regardless of client platform.

---

## Testing strategy

This project has **no automated test harness** and is intentionally zero-framework, zero-build. Testing is therefore primarily **manual-in-browser**, with **local Node verification** for the pure, testable logic (mirroring the existing `data/_verify.js` precedent). We do not introduce a test framework into the shipped app.

### Pure logic — local Node (where property tests apply)

A few pieces are pure functions with meaningful input variation and are worth small Node-runnable property/example checks (run with `node`, no framework), following the `data/` script precedent:

- **`VideoSurface.getProgress` / `seek` math** — clamping to [0,1], and the `seek`→`getProgress` round-trip (the contract's most testable invariant). Extracted as a tiny pure helper so it can be exercised without a DOM (the `<mux-player>` element is stubbed with `{currentTime, duration}`).
- **Mux webhook signature verification** — `verifyMuxSignature(raw, header, secret)` is pure crypto; sign-then-verify round-trips, tampered bodies/timestamps fail. Runnable in Deno locally.
- **Sliding-window math** — given an active index, window start, and total loaded, the decision "fetch next window?" and "which players stay mounted?" are pure and table-testable.

### Manual-in-browser (everything UI / integration)

- **Surface parity**: a feed of mixed video + gradient clips loops continuously; tap/double-tap, mute toggle, progress bar, and rail behave identically (Req 5.9, 10.3).
- **Upload pipeline (integration, 1–3 examples)**: upload a real file, watch progress, confirm a `processing` row appears and is excluded from the feed, then confirm the webhook flips it to `live` with a playback id and it appears. This exercises Mux + Supabase wiring, which is integration, not property, territory.
- **Auth gating**: guest cannot reach the upload mint; guest can still watch live clips; the Fire/Save/Share/Watch It rail stays present (Req 11).
- **Poster/fallback**: a clip with a thumbnail shows the Mux poster; a clip without one shows the gradient (Req 7).
- **Edge cases**: kill the network mid-upload (Req 12.1); point at an unreachable function (Req 12.5); a forged webhook call is rejected (Req 3.3); a duplicate ready event is a no-op (Req 3.5).

### Local static serving

Manual testing runs against the static files served locally (e.g. a simple static server); Edge Functions are tested against the deployed Supabase project (or `supabase functions serve` locally for the founder). These are run manually — no watch-mode/dev-server is started by the agent.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Each property below is paired with its testing approach. Property tests use a generator-driven runner (≥100 iterations) against the **pure** helpers extracted for this purpose (progress math, signature verification, loader filter/mapping over plain row objects, factory selection over plain clip objects, window math), runnable locally with Node/Deno — consistent with the project's no-framework, manual-in-browser posture. UI/integration criteria are covered by the manual and integration tests in the Testing Strategy and are intentionally not property tests.

### Property 1: Feed loader returns only live, non-deleted clips

*For any* collection of `content` rows with arbitrary `status` values (`draft`, `processing`, `live`, `removed`) and arbitrary `deleted_at` values, the loader's output contains a clip for a row *if and only if* that row has `status == 'live'` and `deleted_at == null`.

**Validates: Requirements 2.3, 4.3, 12.3**

### Property 2: Loader maps Mux fields from the correct columns

*For any* live `content` row, the mapped clip's `muxPlaybackId` equals the row's `mux_playback_id` and the clip's `poster` equals the row's `thumbnail_url`; and *for any* row whose `mux_playback_id` is null, the mapped clip's `muxPlaybackId` is falsy (so it routes to `GradientSurface`).

**Validates: Requirements 4.2, 4.4**

### Property 3: Surface factory selects video iff a playback id is present

*For any* clip object, `ssCreateSurface` returns a `VideoSurface` when `clip.muxPlaybackId` is truthy and a `GradientSurface` otherwise, and in both cases the returned object exposes the full `MediaSurfaceContract`.

**Validates: Requirements 5.2, 5.3, 10.1**

### Property 4: getProgress is always a fraction in [0,1]

*For any* `currentTime` and `duration` values (including `duration` of 0, undefined, or non-finite), `VideoSurface.getProgress()` returns a number in the closed range [0, 1].

**Validates: Requirements 5.4, 6.5**

### Property 5: seek and getProgress round-trip

*For any* fraction `f` in [0, 1] and any finite `duration > 0`, calling `seek(f)` and then `getProgress()` returns a value equal to `f` within floating-point tolerance.

**Validates: Requirements 5.5**

### Property 6: Muted state round-trips through the player

*For any* boolean `m`, calling `setMuted(m)` and then `isMuted()` returns `m`.

**Validates: Requirements 6.4**

### Property 7: Webhook signature verification accepts only authentic events

*For any* request body and signing secret, a signature produced with that secret verifies as authentic; and *for any* mutation of the body, the timestamp, or the signature value, verification fails.

**Validates: Requirements 3.3**

### Property 8: Webhook status flip is idempotent

*For any* content row matched by a `video.asset.ready` event, applying the webhook handler two or more times produces the same final row state (status `live` with the same playback id, thumbnail, and duration) as applying it exactly once.

**Validates: Requirements 3.1, 3.2, 3.5**

### Property 9: Next window is fetched exactly once at the threshold

*For any* active clip index relative to the current window start, the "fetch next window" decision is true once the active index reaches `windowStart + 6` (and another page may exist) and is never triggered more than once for the same window.

**Validates: Requirements 9.3**

### Property 10: Concurrent mounted players are bounded

*For any* active clip index and any total number of loaded clips, the set of clips whose `VideoSurface` is mounted has size no greater than `SS_MAX_LIVE_PLAYERS`.

**Validates: Requirements 9.5**

### Testing notes

- **Property test configuration**: minimum 100 generated iterations per property. Each property test is tagged in the format **Feature: mux-video-clips, Property {n}: {property text}** and references the design property it validates.
- **Pure-helper extraction**: Properties 4–6 require isolating the progress/mute math from the DOM by stubbing the `<mux-player>` element with a plain object exposing `currentTime`, `duration`, and `muted`. Property 2/3 operate on plain row/clip objects. Property 7 runs against the Deno `crypto.subtle` HMAC helper. Properties 1, 8, 9, 10 run against pure decision/transform helpers over in-memory arrays.
- **Not property-tested (by design)**: the upload pipeline (1.1, 1.4, 2.1, 2.5, 3.1–3.2 wiring), CDN/setup (6.1), RLS enforcement (2.5, 11.3), and all UI behaviors (1.5, 7.1/7.3, 8.x, 10.3, 11.x, 12.1/12.2 badges) are verified by the integration and manual tests described in the Testing Strategy — they either test external services or have no meaningful input-varying universal property.
