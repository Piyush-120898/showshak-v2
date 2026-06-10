# Design Document — Watch It Availability

## Overview

This feature gives ShowShak real, region-aware "Watch It" streaming availability
under a hard constraint: **the browser never touches TMDB** (TMDB is ISP/DNS-blocked
in India and Supabase lives in Mumbai). The architecture is therefore **cache-first**
with a clean producer/consumer split:

- **Producer (NEW):** a standalone local Node script, `data/ingest-tmdb.js`, run
  manually by the founder on a TMDB-reachable network. It is the *only* component
  that calls TMDB. It links `titles` rows to TMDB, fetches region-aware flatrate
  providers, maps them onto our `platforms` catalog, and writes the result into
  `titles.providers` (JSONB keyed by region) + `titles.cached_at` using the Supabase
  **service role** key.
- **Consumer (EDIT):** the existing vanilla-JS frontend (`showshak-shared.js`) reads
  the cached `titles.providers` through the anon key, resolves the viewer's region and
  subscriptions, and renders the Watch It sheet — with a graceful fallback chain when a
  region has no cached providers.

The two sides communicate only through the database. No TMDB key, URL, or network call
ever exists in any browser file, the git repo, or any India-egress path.

### Component status at a glance

| Component | Status | File |
|---|---|---|
| TMDB ingest script | **NEW** | `data/ingest-tmdb.js` |
| Local env handling + example | **NEW** | `data/.env` (gitignored), `data/.env.example` |
| `.gitignore` entry for `data/.env` | **NEW/EDIT** | `.gitignore` |
| Provider → platform catalog map | **NEW** | inside `data/ingest-tmdb.js` (write-time) + tiny neutral fallback in frontend |
| `ssResolveWatchOptions()` resolver | **NEW** | `showshak-shared.js` |
| `ssGetRegion()` + profile/subscription cache | **NEW** | `showshak-shared.js` |
| `ssLoadClips()` select expansion | **EDIT** | `showshak-shared.js` |
| `ssClipsForFeed()` / `ssClipsForDiscover()` | **EDIT** | `showshak-shared.js` |
| `ssOpenSheet()` (neutral-message branch) | **EDIT** | `showshak-shared.js` |
| `ssHandleWatchNow()` | **UNCHANGED** (preserved) | `showshak-shared.js` |

## Architecture

```
                          ╔════════════════════════════════════════╗
   FOUNDER'S MACHINE       ║  Founder runs:  node data/ingest-tmdb.js ║
   (TMDB-reachable, VPN)   ╚════════════════════════════════════════╝
                                          │
              data/.env  ──────────────►  │  TMDB_API_KEY
              (gitignored)                │  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
                                          ▼
                              ┌────────────────────────┐        HTTPS GET
                              │   data/ingest-tmdb.js   │ ───────────────────►  api.themoviedb.org
                              │  (Node, service role)   │  /search/movie|tv
                              └───────────┬────────────┘  /{movie|tv}/{id}/watch/providers
                                          │  upsert titles.providers + tmdb_id + cached_at
                                          ▼
                           ╔══════════════════════════════════╗
                           ║   Supabase Postgres (Mumbai/IN)   ║
                           ║   titles.providers  (JSONB/region)║
                           ║   platforms, user_subscriptions   ║
                           ║   content, users.region           ║
                           ╚══════════════════╤═══════════════╝
                                              │  anon key, RLS, read-only (cache)
                                              ▼
   END USER (India)             ┌────────────────────────────┐
   browser, NO TMDB access      │   showshak-shared.js         │
                                │   ssLoadClips() (EDIT)       │
                                │   ssClipsForFeed/Discover    │
                                │   ssResolveWatchOptions(NEW) │
                                │   ssOpenSheet() → Watch sheet │
                                └────────────────────────────┘
```

**Trust / egress boundary:** everything above the database touches TMDB and uses the
service role key — it runs only on the founder's machine. Everything below the database
is the shipped app — anon key only, cache reads only.

## Components and Interfaces

### A) Ingest script — `data/ingest-tmdb.js` (NEW)

A standalone Node script. It is **not** part of any HTML page or frontend bundle and is
never `<script>`-included. The founder invokes it manually:

```bash
# one-time, on a TMDB-reachable network
node data/ingest-tmdb.js            # link + cache titles missing a tmdb_id
node data/ingest-tmdb.js --force    # re-link + re-cache ALL titles
```

#### Configuration & secrets

Secrets come from a local `data/.env` file, never from code or the repo:

```
# data/.env   (GIT-IGNORED — never committed)
TMDB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://koqfxgrlwczlizfopmwa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role...
```

Two supported ways to load it (the script documents both):

1. **Native (preferred, Node ≥ 20.6):** `node --env-file=data/.env data/ingest-tmdb.js`.
2. **Self-contained fallback:** a ~15-line `_loadEnv()` that reads `data/.env`, splits on
   the first `=` per line, ignores blanks/`#` comments, and sets `process.env` if unset.
   This keeps the script dependency-light (only `@supabase/supabase-js`).

The repo ships `data/.env.example` with **placeholder** values and zero real keys:

```
# data/.env.example  (committed — placeholders only)
TMDB_API_KEY=your_tmdb_v3_api_key_here
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

`.gitignore` gains `data/.env` (and `.env`) so the real file can never be committed.
The script **fails fast** with a clear message if any of the three variables is missing,
so it never runs half-configured.

#### Supabase access (service role)

```js
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
```

The **service role key bypasses RLS**, which is required to update `titles` rows. The
script header documents in bold that this key is server/local-only and must never appear
in any `showshak-*.js`, HTML file, or commit. (`showshak-supabase.js` keeps using only
the anon key — unchanged.)

#### Configurable regions

```js
const REGIONS = ['IN'];   // designed for multiple, e.g. ['IN','US','GB']
const TMDB_DELAY_MS = 300; // polite pacing between TMDB calls
```

#### Control flow

```
main():
  loadEnv(); assertEnv();
  const force = process.argv.includes('--force');
  const titles = await selectTitles(force);
      // force ? all (deleted_at is null)
      //       : tmdb_id is null AND deleted_at is null
  const tally = { matched:0, unmatched:0, failed:0, updated:0, skipped:0 };

  for (const t of titles) {
    try {
      // 1. LINK (skip when already linked and not forced — R1.4)
      let tmdbId = t.tmdb_id, mediaType = t.meta?.media_type;
      if (force || !tmdbId) {
        const match = await searchTmdb(t.name, t.year);     // R1.3
        if (!match) { tally.unmatched++; continue; }         // R1.6 — leave tmdb_id unchanged
        tmdbId = match.id; mediaType = match.media_type;
        tally.matched++;
      } else { tally.skipped++; }

      // 2. PROVIDERS per region (R2.1)
      const raw = await fetchWatchProviders(mediaType, tmdbId); // /{movie|tv}/{id}/watch/providers
      const providers = {};
      for (const region of REGIONS) {
        const flatrate = (raw.results?.[region]?.flatrate) || [];  // R2.2 flatrate ONLY
        providers[region] = flatrate.map(toCacheEntry);            // R2.3 shape + catalog map
      }

      // 3. WRITE (R1.3 tmdb_id, R2.3 providers, R2.4 cached_at)
      await db.from('titles').update({
        tmdb_id: tmdbId,
        providers,
        cached_at: new Date().toISOString(),
        meta: { ...(t.meta||{}), media_type: mediaType }
      }).eq('id', t.id);
      tally.updated++;
    } catch (err) {
      tally.failed++;                                  // R3.3 — record + keep going
      console.error(`✗ ${t.name}: ${err.message}`);
    }
    await sleep(TMDB_DELAY_MS);
  }
  printSummary(tally);                                 // R3.4
```

#### TMDB search + ranking (`searchTmdb`)

- Calls `GET /3/search/movie` and `GET /3/search/tv` by `query=name` (and `year` /
  `first_air_date_year` when a year is known), combining both result sets.
- **Ranking** (best match wins, deterministic):
  1. Normalize names (lowercase, trim, strip punctuation/diacritics). **Exact**
     normalized-name equality ranks above partial.
  2. Among name-equal candidates, **smallest absolute year difference** wins (a title
     with a matching `year` beats one a few years off).
  3. Tie-break by TMDB `popularity` (desc) for stability.
- Returns `{ id, media_type }` where `media_type` is `'movie'` or `'tv'`, or `null` when
  nothing clears a minimum name-similarity threshold (→ unmatched, R1.6).

#### Provider mapping (`toCacheEntry`) — see section B.

#### Watch providers fetch (`fetchWatchProviders`)

`GET /3/{movie|tv}/{tmdbId}/watch/providers` → `results` is keyed by region; each region
exposes `flatrate[]`, `rent[]`, `buy[]`. Only `flatrate[]` is read (R2.2). A region with
no entry yields `[]` for that region.

> **Image note (R-out-of-scope #4):** `logo_path` is stored verbatim for future use, but
> the script never downloads it and the frontend never builds an `image.tmdb.org` URL —
> that host is blocked in India. Styling comes from our `platforms` catalog instead.

### B) Provider → Platform_Catalog mapping (NEW, lives in the ingest)

**Decision:** mapping happens at **write time in the ingest**, not at frontend render
time. The ingest already holds a privileged connection and can read `platforms`, so it
resolves each TMDB provider to our catalog once and bakes the result into the cache
entry. This means the frontend renders the Watch It sheet from a single column with **no
second query**, and the subscription cross-reference (R5) can compare on `platform_id`
directly — the same `platform_id` that `user_subscriptions` references.

**Normalization map** (TMDB `provider_name` → our catalog `platforms.name`):

```js
const PROVIDER_TO_CATALOG = {
  'netflix': 'Netflix',
  'amazon prime video': 'Prime Video',
  'amazon video': 'Prime Video',
  'disney plus hotstar': 'JioHotstar',
  'jiohotstar': 'JioHotstar',
  'jiocinema': 'JioHotstar',
  'disney plus': 'Disney+',
  'apple tv plus': 'Apple TV+',
  'apple tv+': 'Apple TV+',
  'sonyliv': 'SonyLIV',
  'hbo max': 'HBO Max',
  'max': 'HBO Max',
  'zee5': 'Zee5',
  'hulu': 'Hulu'
};
```

At startup the ingest loads the catalog once:
`const catalog = await db.from('platforms').select('id,name,color,abbr').is('deleted_at',null);`
indexed by lowercased `name`.

```js
function toCacheEntry(p) {                 // p = TMDB flatrate provider object
  const canonical = PROVIDER_TO_CATALOG[p.provider_name.trim().toLowerCase()] || null;
  const cat = canonical ? catalogByName[canonical.toLowerCase()] : null;
  return {
    // ── canonical TMDB fields (satisfies R2.3 shape exactly) ──
    provider_name: p.provider_name,
    provider_id:   p.provider_id,
    logo_path:     p.logo_path || null,    // stored, not fetched (India block)
    type:          'flatrate',
    // ── catalog enrichment (additive; powers R5 + R11 without a 2nd query) ──
    platform_id:   cat ? cat.id   : null,  // nullable — reconciles with user_subscriptions
    catalog_name:  cat ? cat.name : null,
    color:         cat ? cat.color: null,  // null → frontend uses neutral default
    abbr:          cat ? cat.abbr : null
  };
}
```

The required four fields (`provider_name`, `provider_id`, `logo_path`, `type`) are always
present (R2.3); `platform_id`/`color`/`abbr` are added when a catalog match exists and are
`null` otherwise. The frontend treats a `null` `color`/`abbr` as the signal to apply
neutral default styling (R11.2).

### C) Frontend read path (EDITS + one NEW resolver) — `showshak-shared.js`

#### C1. `ssLoadClips()` — **EDIT** the select + mapping

Expand the `titles` join to pull `providers` and `cached_at`, and keep
`content.platform_id` (via the `platform` join) as the curator fallback platform.

```js
// BEFORE: title:title_id(name,year,synopsis)
// AFTER:
.select("id, description, fires_count, meta, status, " +
        "creator:creator_id(username,name,avatar_url), " +
        "title:title_id(name,year,synopsis,providers,cached_at), " +
        "platform:platform_id(id,name,color,abbr)")    // + id so curator fallback carries platform_id
```

In the row mapper, carry the new fields onto the clip object (everything else unchanged):

```js
providers:    t.providers || {},     // region-keyed Provider_Cache
cachedAt:     t.cached_at || null,
curatorPlat:  p.name ? { platform_id:p.id||null, name:p.name, color:p.color, abbr:p.abbr } : null,
```

#### C2. Region & subscription resolution — **NEW** small caches

```js
// users.region for the signed-in user; default 'IN' for guests/unknown (R9)
let _ssRegion = null, _ssSubIds = null;

async function ssGetRegion() {
  if (_ssRegion) return _ssRegion;
  try {
    const me = window.ssCurrentUser && window.ssCurrentUser();
    if (me && window.ssDB) {
      const { data } = await window.ssDB.from('users').select('region').eq('id', me.id).single();
      _ssRegion = (data && data.region) || 'IN';
    } else { _ssRegion = 'IN'; }
  } catch (e) { _ssRegion = 'IN'; }   // R9.2 default
  return _ssRegion;
}

// Set of platform_id the signed-in user holds; empty Set for guests (R8.2)
async function ssGetSubscribedPlatformIds() {
  if (_ssSubIds) return _ssSubIds;
  _ssSubIds = new Set();
  try {
    const me = window.ssCurrentUser && window.ssCurrentUser();
    if (me && window.ssDB) {
      const { data } = await window.ssDB.from('user_subscriptions')
        .select('platform_id').eq('user_id', me.id).is('deleted_at', null);
      (data || []).forEach(r => _ssSubIds.add(r.platform_id));
    }
  } catch (e) { /* R8.3 — swallow, leave set empty */ }
  return _ssSubIds;
}
```

Both caches are invalidated on `onAuthStateChange` (set `_ssRegion = null; _ssSubIds = null;`)
so a sign-in/sign-out re-resolves region and plan.

#### C3. `ssResolveWatchOptions(clip, region, subscribedPlatformIds)` — **NEW** single resolver

This is the one place that turns cached data into sheet options. The feed, discover, and
the unified viewer all funnel through it, so Watch It behaves identically everywhere
(the unified-engine principle).

```js
function ssResolveWatchOptions(clip, region, subscribedPlatformIds) {
  region = region || 'IN';
  const subs = subscribedPlatformIds || new Set();
  const regionProviders = (clip.providers && clip.providers[region]) || [];

  // 1. Region has cached flatrate providers → map each to a sheet option
  if (regionProviders.length) {
    const options = regionProviders.map(function (e) {
      const matched   = !!e.color;                       // catalog-matched → branded
      const included  = !!(e.platform_id && subs.has(e.platform_id));  // R5.2
      return {
        name:        e.catalog_name || e.provider_name,
        color:       matched ? e.color : 'var(--ss-neutral, #2a2a2a)', // R11.1 / R11.2
        label:       e.abbr || (e.provider_name ? e.provider_name.charAt(0) : '▶'),
        sub:         included ? 'In your plan' : 'Available to stream',
        included:    included,
        platform_id: e.platform_id || null
      };
    });
    // R5.3 — In_Your_Plan first, otherwise stable order
    options.sort(function (a, b) { return (b.included ? 1 : 0) - (a.included ? 1 : 0); });
    return { options: options, fallback: false, message: null };
  }

  // 2. Fallback chain — curator's chosen platform as a single option (R6.1)
  if (clip.curatorPlat) {
    const cp = clip.curatorPlat;
    const included = !!(cp.platform_id && subs.has(cp.platform_id));
    return {
      options: [{
        name:  cp.name,
        color: cp.color || 'var(--ss-neutral, #2a2a2a)',
        label: cp.abbr || (cp.name ? cp.name.charAt(0) : '▶'),
        sub:   included ? 'In your plan' : 'Available to stream',
        included: included,
        platform_id: cp.platform_id || null
      }],
      fallback: true, message: null
    };
  }

  // 3. Neutral message — nothing cached, no curator platform (R6.2)
  return { options: [], fallback: true, message: 'Not available to stream in your region' };
}
```

Key guarantees: it never throws on missing `providers`, missing region, or empty subs
(R6.3, R8.3); guests pass an empty Set so nothing is marked "In your plan" (R8.1, R8.2).

#### C4. `ssClipsForFeed()` / `ssClipsForDiscover()` — **EDIT** to carry cache forward

These builders no longer synthesize a single hardcoded mock platform. They carry the raw
cache + curator fallback through so the sheet can resolve at open time (region/subs are
async, the sheet open is the natural resolve point):

```js
function ssClipsForFeed(base){ return base.map(function(c){ return {
  id:c.id, title:(c.title||"").toUpperCase(), year:c.year, genre:c.genre, lang:c.lang,
  season:c.season, synopsis:c.synopsis, caption:c.caption, creator:c.creator, litCount:c.fires,
  providers:c.providers, curatorPlat:c.curatorPlat,        // ← carried for the resolver (R4.2)
  platLabel:(c.curatorPlat&&c.curatorPlat.name)||"", platColor:(c.curatorPlat&&c.curatorPlat.color)||"#EA3B32",
  bg:c.bg }; }); }
```

`ssClipsForDiscover()` likewise carries `providers` and `curatorPlat` so a clip opened
from Discover resolves identically. The visible clip surface still shows no title; the
title is revealed only in the sheet (R10.3).

#### C5. `ssOpenSheet(show)` — **EDIT** to resolve + render the neutral branch

`ssOpenSheet` becomes async-aware: it resolves region + subs, runs the resolver, then
renders either the option list or the neutral message.

```js
async function ssOpenSheet(show) {
  if (!show) return;
  // ... existing header render (title revealed here only — R10.3) ...

  const region = await ssGetRegion();
  const subs   = await ssGetSubscribedPlatformIds();
  const res    = ssResolveWatchOptions(show, region, subs);

  const opts = document.getElementById('sheet-options');
  if (opts) {
    if (res.message) {                                   // R6.2 neutral branch
      opts.innerHTML = '<div class="sheet-empty">' + res.message + '</div>';
    } else {
      opts.innerHTML = res.options.map(function (p) { return `
        <div class="sheet-option" onclick="ssHandleWatchNow('${p.name}', '${show.title}')">
          <div class="sheet-plat-logo" style="background:${p.color}">${p.label}</div>
          <div class="sheet-option-info">
            <div class="sheet-option-name">${p.name}</div>
            <div class="sheet-option-sub">${p.sub}</div>
            ${p.included ? '<span class="sheet-included">✓ In your plan</span>' : ''}
          </div>
          <span class="sheet-option-arrow">›</span>
        </div>`; }).join('');
    }
  }
  // ... existing overlay .open toggles ...
}
```

#### C6. `ssHandleWatchNow()` — **UNCHANGED** (preserved per R7.2)

Behavior is preserved exactly. Routing to a public universal-link URL pattern (R7.1) is a
thin extension point inside this function if/when needed; affiliate/paid attribution stays
out of scope.

## Data Models

### Provider_Cache (the `titles.providers` JSONB)

```jsonc
// titles.providers — keyed by Region
{
  "IN": [
    { "provider_name": "Netflix", "provider_id": 8, "logo_path": "/abc.jpg",
      "type": "flatrate", "platform_id": "uuid-netflix", "catalog_name": "Netflix",
      "color": "#E50914", "abbr": "N" },
    { "provider_name": "Some Niche OTT", "provider_id": 999, "logo_path": "/xyz.jpg",
      "type": "flatrate", "platform_id": null, "catalog_name": null,
      "color": null, "abbr": null }            // unmatched → neutral styling
  ],
  "US": [ /* ... */ ]
}
```

`titles.cached_at` records the last successful update for that row.

### Sheet option (frontend, produced by `ssResolveWatchOptions`)

`{ name, color, label, sub, included, platform_id }` — consumed verbatim by `ssOpenSheet`.

### Catalog reference (existing `platforms`)

Netflix `#E50914`/`N`, Prime Video `#00A8E0`/`P`, Disney+ `#0E3BD4`/`D+`,
JioHotstar `#FF6A00`/`JH`, Apple TV+ `#111111`/`▶`, SonyLIV `#002868`/`S`,
HBO Max `#5C2D91`/`HBO`, Zee5 `#6B1DF5`/`Z5`, Hulu `#1CE783`/`H`.

## Data / State Flow

**Ingest (offline, founder-triggered):**
```
select titles → per title: search TMDB → rank/pick → set tmdb_id
            → fetch watch/providers → filter flatrate → map to catalog
            → build region-keyed providers → update titles.providers + cached_at
            → tally; on per-title error: tally.failed++, continue → print summary
```

**Read (browser, per session):**
```
ssLoadClips() pulls providers + cached_at + curatorPlat
   → ssClipsForFeed/Discover carry them onto clips
   → user taps Watch It → ssOpenSheet()
        → ssGetRegion() (cached)        → region
        → ssGetSubscribedPlatformIds()  → Set<platform_id> (cached)
        → ssResolveWatchOptions(clip, region, subs)
              region has providers? → branded/neutral options, In-plan first
              else curator platform? → single curator option
              else                  → "Not available to stream in your region"
   → ssHandleWatchNow(platform, title)
```

## Error Handling

| Situation | Where | Behavior |
|---|---|---|
| Missing env var (TMDB/Supabase) | ingest startup | Fail fast with explicit message; no partial run (R1.1, R3.1) |
| TMDB network/HTTP error for a title | ingest per-title | Caught; `tally.failed++`; continue to next title (R3.3) |
| TMDB search returns no match | ingest per-title | Leave `tmdb_id` unchanged; `tally.unmatched++` (R1.6) |
| Title has `tmdb_id`, not `--force` | ingest per-title | Skip linking; `tally.skipped++` (R1.4) |
| `watch/providers` has no entry for a region | ingest | Store `[]` for that region (no crash) |
| `titles.providers` empty/missing in browser | `ssResolveWatchOptions` | Region read yields `[]` → fallback chain (R6) |
| Region unknown / guest | `ssGetRegion` | Default `'IN'` (R9.2) |
| `user_subscriptions` fetch fails | `ssGetSubscribedPlatformIds` | Empty Set; sheet still renders (R8.3) |
| No region providers + no curator platform | `ssResolveWatchOptions` | Neutral message, never empty/error (R6.2, R6.3) |
| Offline read | frontend | Reads only cached Supabase data; never calls TMDB (R4.3) |

## Testing Strategy

No automated test framework is added (the app is vanilla JS/HTML/CSS served statically).
Verification is split into a **manual browser regression checklist** and an **ingest
dry-run/verification**. The Correctness Properties below define the universal behaviors
each manual check is exercising.

### Manual browser regression checklist (frontend)

Run on both the **feed** and the **unified clip viewer** (and spot-check Discover):

1. **Title WITH providers in IN** → Watch It sheet lists the cached flatrate providers,
   branded with catalog colors/abbr. (R4.2, R11.1)
2. **Title with NONE for IN, but a curator platform set** → sheet shows exactly the
   curator's `content.platform_id` platform as a single option. (R6.1)
3. **Title with NONE and no curator platform** → sheet shows
   "Not available to stream in your region", no empty list, no console error. (R6.2, R6.3)
4. **Signed-in user with a matching subscription** → that provider shows "✓ In your plan"
   and is ordered first. (R5.2, R5.3)
5. **Guest / logged-out** → providers render with no "In your plan" badge, no error.
   (R8.1, R8.2)
6. **Provider not in catalog** → renders with neutral default styling, still tappable.
   (R11.2)
7. **Regression sweep** → feed/discover/watchlist/profile + viewer still render; save,
   fire, follow still work; clip surface still hides the title (title only in sheet).
   (R10.1, R10.2, R10.3)
8. **No-TMDB proof** → with DevTools Network open, confirm zero requests to
   `themoviedb.org` / `image.tmdb.org` during normal use. (R4.3)

### Ingest dry-run / verification (Node)

1. Populate `data/.env` from `.env.example` with real keys on a TMDB-reachable network.
2. Run `node data/ingest-tmdb.js` against the seeded demo titles (Sacred Games, The Bear,
   Mirzapur, Stranger Things, Panchayat, Squid Game, Scam 1992, The Last of Us).
3. In Supabase, confirm those rows now have `tmdb_id` set and `titles.providers` populated
   with an `IN` array of `{provider_name,provider_id,logo_path,type:'flatrate',...}`
   entries and a fresh `cached_at`. (R1.3, R2.3, R2.4)
4. Confirm the summary log prints matched / unmatched / failed / updated counts. (R3.4)
5. Run again **without** `--force` → already-linked titles are skipped (no re-link). (R1.4)
6. Run with `--force` → titles re-linked and re-cached. (R1.5)
7. Confirm `git status` never shows `data/.env`; confirm no `showshak-*.js`/HTML contains
   a service-role or TMDB key. (R3.2)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system should do.
Properties serve as the bridge between human-readable specifications and machine-verifiable
correctness guarantees.*

Where property-based tests are added, they target the **pure logic** units —
`ssResolveWatchOptions`, the title-selection predicate, the ranking function, the flatrate
filter/mapper, and the tally accounting. I/O layers (TMDB calls, Supabase reads/writes,
secret handling, UI render) are covered by the SMOKE/INTEGRATION/EXAMPLE checks in the
Testing Strategy, not by property-based tests.

### Property 1: Title selection predicate

*For any* set of `titles` rows, a non-forced run selects exactly the rows where `tmdb_id`
is null and `deleted_at` is null, and a forced (`--force`) run selects exactly the rows
where `deleted_at` is null.

**Validates: Requirements 1.2, 1.5**

### Property 2: Best-match ranking is deterministic and name/year-ordered

*For any* non-empty list of TMDB candidates for a title, the selected match is a candidate
whose normalized name equals the title name when one exists, and among those the one with
the smallest absolute year difference (popularity breaking ties); when no candidate clears
the similarity threshold, no match is selected.

**Validates: Requirements 1.3**

### Property 3: Skip-unless-forced linking

*For any* title that already has a non-null `tmdb_id`, a non-forced run leaves `tmdb_id`
unchanged and performs no linking, while a forced run re-links it.

**Validates: Requirements 1.4, 1.5**

### Property 4: Unmatched titles are preserved and counted

*For any* title whose TMDB search yields no qualifying match, the run leaves `titles.tmdb_id`
unchanged and increments the unmatched count by exactly one for that title.

**Validates: Requirements 1.6**

### Property 5: Only flatrate offers are cached

*For any* TMDB `watch/providers` payload for a region, the cached region array contains an
entry for every flatrate offer and no entry derived from a rent or buy offer.

**Validates: Requirements 2.2**

### Property 6: Cache entry shape and region keying

*For any* mapped provider, the resulting Provider_Cache_Entry contains `provider_name`,
`provider_id`, `logo_path`, and `type` equal to `"flatrate"`, and is stored under a
region key in the `titles.providers` object.

**Validates: Requirements 2.3**

### Property 7: Resilient batch processing with correct tallies

*For any* batch of titles in which an arbitrary subset raises errors during processing, the
run attempts every title (never aborting early), and the final summary's matched, unmatched,
failed, and updated counts equal the sizes of their respective outcome partitions.

**Validates: Requirements 3.3, 3.4**

### Property 8: Sheet options derive from the region's cached providers

*For any* clip whose `providers[region]` is non-empty, `ssResolveWatchOptions` returns one
option per cached entry (no hardcoded mock platform), reading streaming availability solely
from the clip's cached data.

**Validates: Requirements 4.2, 5.1, 8.1**

### Property 9: Subscription inclusion marking

*For any* resolved provider options and any set of subscribed `platform_id`s, an option is
marked included ("✓ In your plan") exactly when its `platform_id` is non-null and present in
the subscription set; when the subscription set is empty, no option is marked included.

**Validates: Requirements 5.2, 8.2**

### Property 10: In-plan ordering

*For any* resolved option list, no option that is not in the user's plan appears before an
option that is in the user's plan.

**Validates: Requirements 5.3**

### Property 11: Fallback chain selection

*For any* clip with an empty `providers[region]`: if a curator platform
(`content.platform_id`) is present, `ssResolveWatchOptions` returns exactly that one option;
otherwise it returns an empty option list together with the message "Not available to stream
in your region".

**Validates: Requirements 6.1, 6.2**

### Property 12: Resolver totality (never throws, never empty-and-silent)

*For any* clip, region, and subscription set — including missing or malformed `providers`,
an unknown region, or a failed subscription fetch — `ssResolveWatchOptions` returns a
well-formed result without throwing, where either the option list is non-empty or a fallback
message is present.

**Validates: Requirements 6.3, 8.3**

### Property 13: Region resolution

*For any* signed-in user, `ssGetRegion` resolves to that user's `users.region`; for any
guest or any user whose region is null/unknown, it resolves to `"IN"`.

**Validates: Requirements 9.1, 9.2**

### Property 14: Catalog-consistent provider styling

*For any* provider that maps to a Platform_Catalog entry, its option uses the catalog
`name`, `color`, and `abbr`; for any provider with no catalog match, its option uses neutral
default styling and is still rendered as a selectable option.

**Validates: Requirements 11.1, 11.2**
