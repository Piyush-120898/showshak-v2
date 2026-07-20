// ═══════════════════════════════════════════════════════════════
// supabase/functions/tmdb-providers/index.ts — server-side TMDB ingest
// ───────────────────────────────────────────────────────────────
// WHY: TMDB is DNS-blocked on Indian consumer ISPs, so the local
// data/ingest-tmdb.js had to be run manually behind a VPN. This Edge
// Function runs the SAME link → fetch providers → fetch genres → write
// pipeline on Supabase's servers (which reach TMDB), so it works
// hands-off and is independent of where the frontend is hosted (GitHub
// Pages today, your own domain later — Supabase stays the backend).
//
// MODES (POST JSON body):
//   { "mode": "batch", "force": false }   → all titles missing tmdb_id
//                                            (force:true re-links ALL)
//   { "titleId": "<uuid>", "force": true } → cache ONE title now
//                                            (call this from the upload
//                                             flow when a curator links
//                                             a title → instant providers)
//
// AUTH:
//   • batch mode requires the shared INGEST_SECRET (header x-ingest-secret
//     or body.secret) — used by the schedule / an admin. Prevents anyone
//     from triggering a full re-ingest.
//   • single-title mode accepts EITHER the INGEST_SECRET OR a logged-in
//     user's Supabase JWT (a curator linking one title is bounded + safe).
//
// SECURITY: TMDB_API_KEY + SUPABASE_SERVICE_ROLE_KEY are function secrets,
// read only here, never returned or logged. The browser only ever READS
// the cached titles.providers with the anon key — it never touches TMDB.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { corsHeadersFor, isOriginAllowed } from "../_shared/cors.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const REGIONS = ["IN"];                       // extend later: ["IN","US","GB"]
const TMDB_DELAY_MS = 250;                    // polite pacing between titles
const NAME_SIMILARITY_THRESHOLD = 0.6;
const MAX_BODY_BYTES = 16 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Per-request JSON responder bound to the caller's CORS origin. Built once
// per request inside the handler (see makeJson) so the allow-listed origin is
// echoed back correctly under concurrency.
type Json = (body: unknown, status?: number) => Response;
function makeJson(req: Request): Json {
  const cors = corsHeadersFor(req);
  return (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// TMDB provider_name → our platforms catalog `name` (lowercased keys).
// NOTE: keys are matched with String(provider_name).trim().toLowerCase() —
// keep every key fully lowercase.
const PROVIDER_TO_CATALOG: Record<string, string> = {
  "netflix": "Netflix",
  "amazon prime video": "Prime Video",
  "amazon video": "Prime Video",
  "disney plus hotstar": "JioHotstar",
  "jiohotstar": "JioHotstar",
  "jiocinema": "JioHotstar",
  "disney plus": "Disney+",
  "apple tv plus": "Apple TV+",
  "apple tv+": "Apple TV+",
  "sonyliv": "SonyLIV",
  "hbo max": "HBO Max",
  "max": "HBO Max",
  "zee5": "Zee5",
  "hulu": "Hulu",
  // Lionsgate Play (0039) — standalone + the Prime Video / Apple TV Channels
  // add-on variants TMDB reports for the IN region all map to the one catalog row.
  "lionsgate play": "Lionsgate Play",
  "lionsgate play amazon channel": "Lionsgate Play",
  "lionsgate play apple tv channel": "Lionsgate Play",
  // Remaining active-catalog platforms TMDB reports in IN (were unmapped →
  // platform_id null → invisible to subscriptions/chips).
  "crunchyroll": "Crunchyroll",
  "sun nxt": "Sun NXT",
  "aha": "Aha",
  "hoichoi": "Hoichoi",
  "manoramamax": "ManoramaMax",
};

function normalizeName(name: string): string {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sa = new Set(na.split(" ")), sb = new Set(nb.split(" "));
  let inter = 0;
  sa.forEach((t) => { if (sb.has(t)) inter++; });
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}
function candidateYear(c: any): number | null {
  const y = parseInt(String(c.release_date || c.first_air_date || "").slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}
function candidateName(c: any): string {
  return c.title || c.name || c.original_title || c.original_name || "";
}

async function tmdbSearch(apiKey: string, mediaType: string, name: string, year?: number | null): Promise<any[]> {
  const params = new URLSearchParams({ api_key: apiKey, query: name, include_adult: "false" });
  if (year) params.set(mediaType === "tv" ? "first_air_date_year" : "year", String(year));
  const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB search/${mediaType} HTTP ${res.status}`);
  const j = await res.json();
  return (j.results || []).map((r: any) => ({ ...r, media_type: mediaType }));
}

async function searchTmdb(apiKey: string, name: string, year?: number | null): Promise<{ id: number; media_type: string } | null> {
  const [movies, tv] = await Promise.all([
    tmdbSearch(apiKey, "movie", name, year),
    tmdbSearch(apiKey, "tv", name, year),
  ]);
  const candidates = movies.concat(tv);
  if (!candidates.length) return null;
  const targetNorm = normalizeName(name);
  const _tt = new Set(targetNorm.split(" ").filter(Boolean));
  const viable = candidates.filter((c) => {
    const cn = normalizeName(candidateName(c));
    if (!cn) return false;
    if (cn === targetNorm) return true;
    const ct = new Set(cn.split(" ").filter(Boolean));
    let allIn = _tt.size > 0;
    _tt.forEach((tok) => { if (!ct.has(tok)) allIn = false; });
    if (allIn) return true;
    return nameSimilarity(name, candidateName(c)) >= NAME_SIMILARITY_THRESHOLD;
  });
  if (!viable.length) return null;
  viable.sort((a, b) => {
    const aE = normalizeName(candidateName(a)) === targetNorm ? 1 : 0;
    const bE = normalizeName(candidateName(b)) === targetNorm ? 1 : 0;
    if (aE !== bE) return bE - aE;
    if (year) {
      const ay = candidateYear(a), by = candidateYear(b);
      const ad = ay == null ? Infinity : Math.abs(ay - year);
      const bd = by == null ? Infinity : Math.abs(by - year);
      if (ad !== bd) return ad - bd;
    }
    return (b.popularity || 0) - (a.popularity || 0);
  });
  return { id: viable[0].id, media_type: viable[0].media_type };
}

async function fetchWatchProviders(apiKey: string, mediaType: string, tmdbId: number): Promise<any> {
  const params = new URLSearchParams({ api_key: apiKey });
  const res = await fetch(`${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB watch/providers HTTP ${res.status}`);
  return res.json();
}
async function fetchTitleDetail(apiKey: string, mediaType: string, tmdbId: number): Promise<any> {
  const params = new URLSearchParams({ api_key: apiKey });
  const res = await fetch(`${TMDB_BASE}/${mediaType}/${tmdbId}?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB ${mediaType} detail HTTP ${res.status}`);
  return res.json();
}

function toCacheEntry(p: any, catalogByName: Record<string, any>) {
  const canonical = PROVIDER_TO_CATALOG[String(p.provider_name || "").trim().toLowerCase()] || null;
  const cat = canonical ? catalogByName[canonical.toLowerCase()] : null;
  return {
    provider_name: p.provider_name,
    provider_id: p.provider_id,
    logo_path: p.logo_path || null,
    type: "flatrate",
    platform_id: cat ? cat.id : null,
    catalog_name: cat ? cat.name : null,
    color: cat ? cat.color : null,
    abbr: cat ? cat.abbr : null,
  };
}
function genreNamesFromTmdb(detail: any, mediaType: string, genreMapByType: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const map = (genreMapByType && genreMapByType[mediaType]) || {};
  const push = (name: any) => {
    const n = String(name == null ? "" : name).trim();
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  };
  if (detail && Array.isArray(detail.genres) && detail.genres.length) {
    detail.genres.forEach((g: any) => {
      if (g && g.name) push(g.name);
      else if (g && g.id != null) push(map[g.id]);
      else if (g != null && typeof g !== "object") push(map[g]);
    });
  } else if (detail && Array.isArray(detail.genre_ids)) {
    detail.genre_ids.forEach((id: any) => push(map[id]));
  }
  return out;
}

async function loadCatalog(db: any): Promise<Record<string, any>> {
  const { data, error } = await db.from("platforms").select("id,name,color,abbr").is("deleted_at", null);
  if (error) throw new Error("loadCatalog failed: " + error.message);
  const byName: Record<string, any> = {};
  (data || []).forEach((row: any) => { if (row && row.name) byName[String(row.name).toLowerCase()] = row; });
  return byName;
}
async function loadGenreMaps(apiKey: string): Promise<any> {
  const params = new URLSearchParams({ api_key: apiKey });
  const [m, t] = await Promise.all([
    fetch(`${TMDB_BASE}/genre/movie/list?${params.toString()}`),
    fetch(`${TMDB_BASE}/genre/tv/list?${params.toString()}`),
  ]);
  const maps: any = { movie: {}, tv: {} };
  if (m.ok) (await m.json()).genres?.forEach((g: any) => { if (g?.id != null) maps.movie[g.id] = g.name; });
  if (t.ok) (await t.json()).genres?.forEach((g: any) => { if (g?.id != null) maps.tv[g.id] = g.name; });
  return maps;
}

// Process ONE title row: link → providers → genres → write. Returns a status.
async function processTitle(
  db: any, apiKey: string, t: any, force: boolean,
  catalogByName: Record<string, any>, genreMapByType: any,
): Promise<"unmatched" | "updated"> {
  let tmdbId = t.tmdb_id;
  let mediaType = t.meta && t.meta.media_type;
  if (force || !tmdbId) {
    const match = await searchTmdb(apiKey, t.name, t.year);
    if (!match) return "unmatched";
    tmdbId = match.id; mediaType = match.media_type;
  }
  const raw = await fetchWatchProviders(apiKey, mediaType, tmdbId);
  const providers: Record<string, any[]> = {};
  for (const region of REGIONS) {
    const flatrate = (raw.results && raw.results[region] && raw.results[region].flatrate) || [];
    providers[region] = flatrate.map((p: any) => toCacheEntry(p, catalogByName));
  }
  const detail = await fetchTitleDetail(apiKey, mediaType, tmdbId);
  const genres = genreNamesFromTmdb(detail, mediaType, genreMapByType);
  const { error } = await db.from("titles").update({
    tmdb_id: tmdbId,
    providers,
    cached_at: new Date().toISOString(),
    meta: { ...(t.meta || {}), media_type: mediaType, genres },
  }).eq("id", t.id);
  if (error) throw new Error("update failed: " + error.message);
  return "updated";
}

// ── Upload-flow helpers (search / link / manual) ─────────────────────────

// Ranked TMDB candidates for the upload search box (no DB writes). Returns a
// compact list the curator picks from — top matches across movie + tv.
async function searchCandidates(apiKey: string, query: string, limit = 12) {
  if (!query) return [];
  const [movies, tv] = await Promise.all([
    tmdbSearch(apiKey, "movie", query, null),
    tmdbSearch(apiKey, "tv", query, null),
  ]);
  const all = movies.concat(tv);
  all.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return all.slice(0, limit).map((c: any) => ({
    tmdb_id: c.id,
    media_type: c.media_type,
    name: candidateName(c),
    year: candidateYear(c),
    poster_path: c.poster_path || null,
  }));
}

// Cache providers + genres for a title whose EXACT tmdb_id is already known
// (no re-search — that would risk linking a different show than the curator
// picked). Writes providers/genres/cached_at onto the given title row.
async function cacheKnownTitle(
  db: any, apiKey: string, titleId: string, tmdbId: number, mediaType: string,
  baseMeta: any, catalogByName: Record<string, any>, genreMapByType: any,
) {
  const raw = await fetchWatchProviders(apiKey, mediaType, tmdbId);
  const providers: Record<string, any[]> = {};
  for (const region of REGIONS) {
    const flatrate = (raw.results && raw.results[region] && raw.results[region].flatrate) || [];
    providers[region] = flatrate.map((p: any) => toCacheEntry(p, catalogByName));
  }
  const detail = await fetchTitleDetail(apiKey, mediaType, tmdbId);
  const genres = genreNamesFromTmdb(detail, mediaType, genreMapByType);
  const { error } = await db.from("titles").update({
    tmdb_id: tmdbId, providers, cached_at: new Date().toISOString(),
    meta: { ...(baseMeta || {}), media_type: mediaType, genres },
  }).eq("id", titleId);
  if (error) throw new Error("cache update failed: " + error.message);
}

// Upsert a title for a chosen TMDB id (dedup by tmdb_id) and return its row
// IMMEDIATELY — provider/genre caching runs in the BACKGROUND so the curator's
// pick feels instant. The row carries the tmdb_id, so even if the curator
// publishes before caching finishes, the scheduled batch completes it. Uses the
// candidate name/year the browser already has → no TMDB call on the hot path.
async function linkByTmdbId(
  db: any, apiKey: string, tmdbId: number, mediaType: string,
  name: string | null, year: number | null,
) {
  const existing = await db.from("titles")
    .select("id, name, year, tmdb_id, providers, meta").eq("tmdb_id", tmdbId).is("deleted_at", null).limit(1);
  let row: any;
  if (existing.data && existing.data.length) {
    row = existing.data[0];
  } else {
    let n = (name || "").trim();
    let y = year || null;
    if (!n) {  // candidate name missing (shouldn't happen) → one detail fetch
      const detail = await fetchTitleDetail(apiKey, mediaType, tmdbId);
      n = detail.title || detail.name || detail.original_title || detail.original_name || "Untitled";
      y = parseInt(String(detail.release_date || detail.first_air_date || "").slice(0, 4), 10) || null;
    }
    const ins = await db.from("titles").insert({
      name: n, year: y, tmdb_id: tmdbId, meta: { media_type: mediaType, source: "tmdb" },
    }).select("id, name, year, tmdb_id, meta").single();
    if (ins.error) throw new Error("insert title failed: " + ins.error.message);
    row = ins.data;
  }
  // Background: load catalog + genre maps and cache providers for this exact id.
  const bg = (async () => {
    const catalogByName = await loadCatalog(db);
    const genreMapByType = await loadGenreMaps(apiKey);
    await cacheKnownTitle(db, apiKey, row.id, tmdbId, mediaType, row.meta, catalogByName, genreMapByType);
  })().catch((e: any) => console.error("link bg-cache failed:", e && e.message));
  const ER = (globalThis as any).EdgeRuntime;
  if (ER && typeof ER.waitUntil === "function") ER.waitUntil(bg);
  return row;
}

// Create a MANUAL title (not on TMDB) with the curator-declared platform(s), so
// it's STILL platform-filterable. providers are built in the SAME shape as the
// TMDB cache (IN region) from the chosen platforms-catalog rows.
async function createManualTitle(
  db: any, name: string, year: number | null, platformIds: string[],
  catalogByName: Record<string, any>,
) {
  const catById: Record<string, any> = {};
  Object.values(catalogByName).forEach((c: any) => { if (c && c.id != null) catById[String(c.id)] = c; });
  const entries = (platformIds || []).map((pid) => {
    const cat = catById[String(pid)];
    if (!cat) return null;
    return {
      provider_name: cat.name, provider_id: null, logo_path: null, type: "flatrate",
      platform_id: cat.id, catalog_name: cat.name, color: cat.color, abbr: cat.abbr,
    };
  }).filter(Boolean);
  const providers = entries.length ? { IN: entries } : {};
  const ins = await db.from("titles").insert({
    name, year, tmdb_id: null, providers, cached_at: new Date().toISOString(),
    meta: { source: "curator" },
  }).select("id, name, year, tmdb_id, providers, meta").single();
  if (ins.error) throw new Error("insert manual title failed: " + ins.error.message);
  return ins.data;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    const allowed = isOriginAllowed(req);
    return new Response(allowed ? "ok" : "forbidden", {
      status: allowed ? 200 : 403,
      headers: corsHeadersFor(req),
    });
  }
  const json = makeJson(req);
  if (!isOriginAllowed(req)) return json({ error: "forbidden_origin" }, 403);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const INGEST_SECRET = Deno.env.get("INGEST_SECRET");
  if (!TMDB_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("tmdb-providers: missing TMDB_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secret");
    return json({ error: "server_misconfigured" }, 500);
  }

  const contentLength = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  let body: any;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }
    body = JSON.parse(raw);
  } catch (_e) {
    return json({ error: "bad_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "bad_request" }, 400);
  const mode = body.mode || (body.titleId ? "single" : "batch");
  const force = body.force === true;

  // ── AUTH ──────────────────────────────────────────────────────
  // batch is admin-only (the shared INGEST_SECRET). The upload-flow modes
  // (search / link / manual) and single-title ingest also accept a logged-in
  // curator's Supabase JWT — all bounded, per-title actions.
  const providedSecret = req.headers.get("x-ingest-secret") || "";
  const isAdmin = !!(INGEST_SECRET && providedSecret && providedSecret === INGEST_SECRET);
  const userAllowed = new Set(["single", "search", "link", "manual"]);
  let callerId = "";
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  if (!isAdmin) {
    if (!userAllowed.has(mode)) return json({ error: "unauthorized" }, 401);
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authHeader || !anon) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    callerId = user.id;
    const { data: profile, error: profileError } = await db
      .from("users")
      .select("role,is_guest,deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return json({ error: "authorization_unavailable" }, 503);
    if (!profile || profile.role !== "curator" || profile.is_guest === true || profile.deleted_at) {
      return json({ error: "curator_required" }, 403);
    }
  }

  // Service-role client for privileged titles reads/writes (bypasses RLS).
  if (!isAdmin) {
    const bucket = mode === "search" ? "tmdb_search" : "tmdb_write";
    const { data: decision, error: rateError } = await db.rpc("ss_rate_consume", {
      p_bucket: bucket,
      p_subject: callerId,
    });
    if (rateError || !decision || typeof decision.allowed !== "boolean") {
      return json({ error: "rate_limit_unavailable" }, 503);
    }
    if (!decision.allowed) {
      const retryAfter = Math.max(1, Number(decision.retry_after_seconds) || 60);
      return new Response(JSON.stringify({ error: "rate_limited", retry_after: retryAfter }), {
        status: 429,
        headers: { ...corsHeadersFor(req), "Content-Type": "application/json", "Retry-After": String(retryAfter) },
      });
    }
  }

  if (!["batch", "single", "search", "link", "manual"].includes(mode)) {
    return json({ error: "bad_request", detail: "unsupported mode" }, 400);
  }
  if (mode === "single" && (!UUID_RE.test(String(body.titleId || "")))) {
    return json({ error: "bad_request", detail: "valid titleId required" }, 400);
  }
  if (["link"].includes(mode)) {
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !["movie", "tv"].includes(String(body.mediaType))) {
      return json({ error: "bad_request", detail: "valid tmdbId and mediaType required" }, 400);
    }
  }
  if (mode === "search") {
    const query = String(body.query || "").trim();
    if (query.length < 1 || query.length > 100) return json({ error: "bad_request", detail: "query must be 1-100 characters" }, 400);
  }
  if (mode === "manual") {
    const name = String(body.name || "").trim();
    const ids = Array.isArray(body.platformIds) ? body.platformIds : [];
    if (name.length < 1 || name.length > 200 || ids.length > 20 || ids.some((id: unknown) => !UUID_RE.test(String(id)))) {
      return json({ error: "bad_request", detail: "invalid manual title payload" }, 400);
    }
  }

  try {
    // SEARCH — pure TMDB proxy, no DB needed.
    if (mode === "search") {
      const results = await searchCandidates(TMDB_API_KEY, String(body.query || "").trim());
      return json({ ok: true, mode, results });
    }

    // LINK — curator picked a TMDB result. Returns the title id INSTANTLY;
    // providers are cached in the background (see linkByTmdbId).
    if (mode === "link") {
      if (!body.tmdbId || !body.mediaType) return json({ error: "bad_request", detail: "tmdbId + mediaType required" }, 400);
      const title = await linkByTmdbId(
        db, TMDB_API_KEY, Number(body.tmdbId), String(body.mediaType),
        body.name || null, body.year ? Number(body.year) : null,
      );
      return json({ ok: true, mode, title });
    }

    const catalogByName = await loadCatalog(db);

    // MANUAL — curator-declared title + platform(s); no TMDB call.
    if (mode === "manual") {
      const name = String(body.name || "").trim();
      if (!name) return json({ error: "bad_request", detail: "name required" }, 400);
      const year = body.year ? (parseInt(String(body.year), 10) || null) : null;
      const title = await createManualTitle(db, name, year, body.platformIds || [], catalogByName);
      return json({ ok: true, mode, title });
    }

    const genreMapByType = await loadGenreMaps(TMDB_API_KEY);

    // BATCH / SINGLE — the ingest loop (schedule + admin + single-title refresh).
    let titles: any[] = [];
    if (mode === "single") {
      const { data, error } = await db.from("titles")
        .select("id, name, year, tmdb_id, meta").eq("id", body.titleId).is("deleted_at", null).limit(1);
      if (error) throw new Error("select title failed: " + error.message);
      titles = data || [];
    } else {
      let q = db.from("titles").select("id, name, year, tmdb_id, meta").is("deleted_at", null);
      if (!force) q = q.is("tmdb_id", null);
      const { data, error } = await q;
      if (error) throw new Error("select titles failed: " + error.message);
      titles = data || [];
    }

    const tally = { selected: titles.length, updated: 0, unmatched: 0, failed: 0 };
    for (const t of titles) {
      try {
        const r = await processTitle(db, TMDB_API_KEY, t, force, catalogByName, genreMapByType);
        if (r === "unmatched") tally.unmatched++;
        else tally.updated++;
      } catch (err) {
        tally.failed++;
        console.error(`tmdb-providers ✗ ${t.name}:`, (err as Error).message);
      }
      if (titles.length > 1) await sleep(TMDB_DELAY_MS);
    }
    return json({ ok: true, mode, force, ...tally });
  } catch (err) {
    console.error("tmdb-providers fatal:", (err as Error).message);
    return json({ error: "ingest_failed" }, 500);
  }
});
