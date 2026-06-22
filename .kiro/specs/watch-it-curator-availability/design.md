# Design Document

## Overview

Today the Watch It sheet treats TMDB's cached region providers as the authority.
`ssResolveWatchOptions(clip, region, subs)` (in `showshak-shared.js`) reads
`clip.providers[region]`; only when that list is **completely empty** does it fall
back to a single `clip.curatorPlat`. The result is the trust-breaking failure in
the requirements: a title that streams on Prime Video in India shows "Not
available" because TMDB's `IN` provider list was stale/empty, and the TMDB-link
upload path never asked the curator where it streams.

This feature implements one principle — **TMDB is a hint, the curator is the
authority** — through three coordinated changes that stay inside the existing
architecture (vanilla HTML/CSS/JS, no build step, pure logic in
`showshak-shared.js` dual-exported and property-tested, founder-run migrations):

1. **Storage (Req 3).** A new additive column `content_titles.curator_platform_ids
   uuid[]` stores Curator_Declared_Platforms per `(clip, title)` link, separate
   from the shared `titles.providers`. Migration `0028` (founder-run).

2. **Resolver merge (Req 1, 4, 5, 6, 7).** `ssResolveWatchOptions` is redesigned
   to build `Merged_Availability` = the de-duplicated **union** of (a) the
   region's TMDB providers and (b) the curator-declared platforms resolved
   against the Platform_Catalog — instead of an all-or-nothing fallback. The
   option shape, `ssPlatformWatchUrl` behaviour, In_Your_Plan marking/ordering,
   and the `IN` region default are all unchanged. Stays pure; this is the
   property-tested core.

3. **Upload + edit UI (Req 2, 8, 9).** The upload flow gains a
   Confirm_Availability_Step that, after a title is selected (TMDB **or** manual
   path), shows resolved region availability and an always-available "add/correct
   platform" chip control per linked title. Edit-after-post loads and edits the
   same per-title declarations. Both write `content_titles.curator_platform_ids`.
   Title stays hidden on the clip body (Req 9); this UI lives only in the upload
   flow.

The verified India platform catalog (migration `0027`) is a **dependency**, not
in scope — every selectable platform is a `platforms` row.

### Design principles honoured

- **Sacred rules:** title hidden until Watch It (Req 9.1/9.2), scoreboard hidden
  (Req 9.3), frictionless private Watch It — all preserved; this feature only
  makes the option list more correct.
- **Pure core:** all new resolution logic is in pure, dual-exported helpers with
  no DOM/network, so `node tests/run-all.js` stays green.
- **Backward compatible:** a clip with no curator declarations resolves
  identically to today (the merge of "TMDB providers ∪ ∅" equals "TMDB
  providers").
- **Additive migration:** `0028` adds a nullable/defaulted column; no backfill,
  no data rewrite, no new RLS policy needed (writes ride the existing
  owner-scoped `content_titles` policies; reads ride existing clip read paths).

## Architecture

### Data flow (read side — Watch It)

```mermaid
flowchart TD
  A[content_titles row<br/>title_id + curator_platform_ids uuid[]] --> B[_ssFetchSheetTitles]
  P[platforms catalog<br/>id,name,color,abbr] --> B
  T[titles.providers region-keyed<br/>TMDB hint] --> B
  B -->|per-title input:<br/>providers + declaredPlatforms[]| C[ssResolveWatchOptionsForTitles]
  C -->|delegates per title| D[ssResolveWatchOptions]
  S[user_subscriptions<br/>subscribed platform_ids] --> D
  D -->|Merged_Availability:<br/>union + dedup + In_Your_Plan order| E[Watch_Options array]
  E --> F[Watch It sheet render<br/>unchanged]
  F -->|tap| G[ssPlatformWatchUrl<br/>unchanged]
```

The hot feed query (`ssLoadClips`) is unchanged — curator declarations are
fetched lazily when the Watch It sheet opens, exactly like `_ssFetchSheetTitles`
already fetches per-title providers today.

### Data flow (write side — upload / edit)

```mermaid
flowchart TD
  subgraph Upload[Upload flow]
    H[upPickTmdb / upSubmitManual<br/>title selected] --> I[Confirm_Availability_Step<br/>resolve + show region availability]
    I --> J[chips from upPlatformCatalog<br/>add/correct platforms]
    J --> K[draft.selectedTitles[i].curatorPlatformIds]
  end
  K --> L[publish: insert content_titles rows<br/>incl. curator_platform_ids]
  subgraph Edit[Edit-after-post]
    M[enterEditMode<br/>load content_titles incl. curator_platform_ids] --> N[same Confirm_Availability_Step UI]
    N --> K
  end
  K --> O[saveEdit: delete+insert content_titles<br/>incl. curator_platform_ids]
```

### Why the resolver is the seam

Feed, Discover, the unified viewer, and `get_shared_stack` all funnel Watch It
through `ssResolveWatchOptions` / `ssResolveWatchOptionsForTitles`. Changing the
merge logic in that one pure pair is enough to fix availability everywhere, with
no surface-specific code. The single-title resolver remains the algorithm; the
multi-title wrapper keeps delegating per title (Req 4.5).

## Components and Interfaces

### 1. Pure resolver core (`showshak-shared.js`) — CHANGED

#### `ssResolveWatchOptions(clip, region, subscribedPlatformIds)` — redesigned

Today it is a fallback chain (TMDB list **or** single `curatorPlat` **or**
message). It becomes a **merge**:

- **Inputs (shape extended, backward compatible):**
  - `clip.providers` — region-keyed object of TMDB provider cache entries
    (unchanged). Entry shape (from `toCacheEntry` / `ssMapContentRowsToClips`):
    `{ provider_name, catalog_name, color, abbr, platform_id }`.
  - `clip.declaredPlatforms` — **NEW** region-keyed object
    `{ [region]: Array<{ platform_id, name, color, abbr }> }`, the
    Curator_Declared_Platforms resolved against the Platform_Catalog for that
    region. Absent/empty for clips with no declarations (→ behaves exactly as
    today). For backward compatibility the resolver also still honours the legacy
    single `clip.curatorPlat` by treating it as one declared platform for the
    resolved region.
  - `region` — defaults to `'IN'` when falsy (Req 7.2). Unchanged.
  - `subscribedPlatformIds` — `Set` of platform ids; defaults to empty `Set`
    (Req 6.3). Unchanged.
- **Algorithm:**
  1. `region = region || 'IN'`; `subs = subscribedPlatformIds || new Set()`.
  2. `tmdb = (clip && clip.providers && clip.providers[region]) || []`.
  3. `declared = (clip && clip.declaredPlatforms && clip.declaredPlatforms[region]) || []`;
     if empty and a legacy `clip.curatorPlat` exists, treat
     `declared = [clip.curatorPlat]`.
  4. Map each TMDB entry and each declared platform to the **identical**
     Watch_Option shape `{ name, color, label, sub, included, platform_id }`
     using the same field rules already in the function (branded colour when a
     catalog colour exists, neutral default otherwise; `label` = abbr or first
     letter or `▶`; `sub` = "In your plan" when included else "Available to
     stream"; `included` = `!!(platform_id && subs.has(platform_id))`).
  5. **De-duplicate** the combined list by key `dedupKey(option)` =
     `option.platform_id` when present, else `normalizeName(option.name)`
     (lowercased, trimmed, NFKD-stripped — same normalisation TMDB matching
     uses). First occurrence wins; iterate TMDB first then declared so a platform
     present in both yields exactly one option (Req 4.2). When the duplicate is
     dropped, its `included` flag is OR-ed into the kept option so subscription
     marking is never lost regardless of source order.
  6. **Order:** stable, with In_Your_Plan (`included:true`) first — the existing
     `options.sort((a,b) => (b.included?1:0) - (a.included?1:0))` over the merged
     list (Req 6.2). Stable sort preserves TMDB-then-declared insertion order
     within each group.
  7. **Result:**
     - If merged options non-empty → `{ options, fallback: <bool>, message: null }`.
       `fallback` is `true` when there were no TMDB providers for the region (the
       options came from curator declarations only) and `false` otherwise — this
       keeps the existing field meaningful for callers without changing the
       option list.
     - If **both** sources empty →
       `{ options: [], fallback: true, message: 'Not available to stream in your region' }`
       (Req 1.3, 4 / the neutral case is the ONLY message case).
- **Purity / defensiveness:** no DOM, no network, never throws on missing/null/
  malformed `clip`, `providers`, `declaredPlatforms`, entries, `region`, or `subs`
  (Req 4.6). Every access is guarded exactly as today.

A small pure helper `_ssDedupKey(option)` and the existing-style `normalizeName`
(local copy) support step 5; both are internal (not exported) but covered by the
property tests through the public resolver.

#### `ssResolveWatchOptionsForTitles(titles, region, subs)` — unchanged contract

Still maps over `titles` and delegates each to `ssResolveWatchOptions`, returning
one `{ title, options, fallback, message }` section per input title in order
(Req 4.5). No logic change — it automatically inherits the merge because each
`titles[i]` now carries `declaredPlatforms` (populated by `_ssFetchSheetTitles`).
Non-array input → `[]`; null entries kept and resolved to the neutral branch
(unchanged).

### 2. Sheet input builders (`showshak-shared.js`) — CHANGED

#### `_ssFetchSheetTitles(show)` — populate per-title declared platforms

The `content_titles` fetch gains `curator_platform_ids` and a join to the catalog
so each per-title input carries `declaredPlatforms`:

- Query becomes:
  `.from('content_titles').select('sort_no, curator_platform_ids, titles:title_id ( id, name, year, providers )').eq('content_id', show.id).order('sort_no')`.
- The resolved catalog rows for those ids come from a memoized Platform_Catalog
  map (see `_ssPlatformCatalogMap` below). For each title, build
  `declaredPlatforms = { [region]: ids.map(id => catalog[id]).filter(Boolean) }`.
  Region is the curator's region; declarations are stored for the curator's
  region (`IN` default) — see Data Models.
- The single-title fallback (mock/demo/Discover clips, or fetch error) keeps
  working: it carries `declaredPlatforms` derived from the clip's legacy
  `curatorPlat` when present, else omits it (→ identical to today).
- Still never throws; still caches into `_ssSheetTitlesCache`.

#### `_ssPlatformCatalogMap()` — NEW lightweight memoized loader

A best-effort, fire-and-forget loader (mirroring `ssGetSubscribedPlatformIds`'s
memoization) that fetches `platforms (id,name,color,abbr)` once and caches an
`{ id → {platform_id,name,color,abbr} }` map for resolving declared ids in
`_ssFetchSheetTitles`. Impure (network) so it lives beside the other impure sheet
helpers, not in the pure export block. The PURE resolver never calls it — the
already-resolved `declaredPlatforms` is handed to the resolver as data, keeping
the tested core pure.

#### `ssMapContentRowsToClips(rows)` — unchanged

Continues to set `clip.providers` and the legacy `clip.curatorPlat`. It does
**not** need to populate `declaredPlatforms` because declarations are per
`(clip, title)` and are fetched by `_ssFetchSheetTitles` when the sheet opens.
Carrying the legacy `curatorPlat` keeps single-title/old surfaces correct via the
resolver's legacy honouring (above).

### 3. Upload flow (`showshak-upload.html`) — CHANGED

#### Draft state

`draft.selectedTitles[i]` gains `curatorPlatformIds: string[]` (Platform_Catalog
ids). It defaults to `[]`. For the **manual** path the platforms the curator
already picks become the title's `curatorPlatformIds` (one consistent mechanism —
see below). For the **TMDB** path it starts `[]` and the curator adds/corrects in
the Confirm_Availability_Step.

#### Confirm_Availability_Step

After a title is selected (both `upPickTmdb` and `upSubmitManual` land here), per
linked title render:

- **Resolved availability (Req 2.1):** call the pure
  `ssResolveWatchOptions({ providers: title.providers, declaredPlatforms: {...} }, region, new Set())`
  for the curator's region and show the resulting option names ("Streams on:
  Netflix, Prime Video"). If the result has `message` (both sources empty) show
  "We couldn't confirm where this streams — add the platforms below." (Req 2.2).
- **Add/correct control (Req 2.3, 2.6):** the existing `upPlatformCatalog` chips
  (`upToggleManualPlat` styling) rendered as a toggle set; selected chips =
  `draft.selectedTitles[i].curatorPlatformIds`. Always available, regardless of
  whether availability was found.
- **Remove (Req 2.4):** toggling a chip off removes it from `curatorPlatformIds`.
- **Per-title (Req 2.5):** one chip block per entry in `draft.selectedTitles`,
  edited independently.
- **Catalog source (Req 2.6):** chips come only from `upPlatformCatalog`
  (active Platform_Catalog), loaded via the existing `upEnsurePlatformCatalog()`.

This is a section within the existing STEP 3 (titles) area or a lightweight
sub-panel shown for each selected title; it adds no new pipeline step and does
not change the step model. Title/platform display is confined to the upload flow
(Req 9.2).

#### Reconciling the manual path (one mechanism)

Today `upSubmitManual` sends `platformIds` to the `tmdb-providers` edge function,
which bakes them into the **shared** `titles.providers` (IN) — that violates
Req 3.2 (store separately) and Req 3.4 (per-clip independence). New behaviour:
the manual chips selection is captured into the new title's
`curatorPlatformIds` (per `(clip, title)`), so the manual and TMDB paths use the
**same** `draft.selectedTitles[i].curatorPlatformIds` field and the same publish
write. The edge-function `manual` mode may still create the title row (so it
exists with a name), but the authority for "where it streams on this clip" is the
per-`(clip,title)` declaration, not the shared providers cache. (Leaving the
existing providers-baking in place is harmless — the resolver de-dups by
platform_id — but the per-clip column is the source of truth and is what the
edit flow reads/writes.)

### 4. Edit-after-post (`showshak-upload.html`) — CHANGED

`enterEditMode(contentId)` already loads `content_titles (title_id, sort_no)` and
rebuilds `draft.selectedTitles` from links. Changes:

- Select `curator_platform_ids` in that fetch:
  `.select('title_id, sort_no, curator_platform_ids')`.
- After `ssRowToDraft` reconstructs `selectedTitles` (as `{id}` stubs in order)
  and the re-fetch restores names/posters, attach
  `curatorPlatformIds = link.curator_platform_ids || []` to the matching entry by
  `title_id` (Req 8.1).
- The same Confirm_Availability_Step UI lets the curator add/remove per title
  (Req 8.2).
- `saveEdit` already does delete-then-insert of `content_titles`; the inserted
  rows now include `curator_platform_ids` (Req 8.3).

### 5. Publish / persist wiring (`showshak-upload.html`) — CHANGED

`content_titles` rows are inserted in three places (draft save, publish-fresh,
publish-from-draft) and rewritten in `saveEdit`. The link-row builder gains the
column:

```js
const linkRows = links.map((l, i) => ({
  content_id: cid,
  title_id:   l.title_id,
  sort_no:    l.sort_no,
  curator_platform_ids: (resolvedTitleFor(l.title_id).curatorPlatformIds || [])
}));
```

`ssBuildTitleLinks` returns `{title_id, sort_no}` from `selectedTitles`; the
upload code maps `l.title_id` back to its `selectedTitles` entry to read
`curatorPlatformIds`. No RPC is needed — these are direct
`from('content_titles').insert(...)` calls already owner-scoped by the existing
RLS (`content_titles_insert_own`). DELETE+INSERT semantics already used for
reconciliation carry the new column for free.

### Interfaces summary

| Symbol | File | Change |
|---|---|---|
| `ssResolveWatchOptions` | showshak-shared.js | Redesigned to merge TMDB ∪ declared, de-dup, order |
| `ssResolveWatchOptionsForTitles` | showshak-shared.js | Unchanged (inherits merge per title) |
| `_ssFetchSheetTitles` | showshak-shared.js | Fetch `curator_platform_ids`, build `declaredPlatforms` |
| `_ssPlatformCatalogMap` | showshak-shared.js | NEW memoized catalog loader (impure) |
| `ssMapContentRowsToClips` | showshak-shared.js | Unchanged (keeps legacy `curatorPlat`) |
| Confirm_Availability_Step UI | showshak-upload.html | NEW per-title chips + resolved availability |
| `upSubmitManual` / `upPickTmdb` | showshak-upload.html | Route platform picks into `curatorPlatformIds` |
| publish / saveDraft / saveEdit link writes | showshak-upload.html | Include `curator_platform_ids` |
| `enterEditMode` | showshak-upload.html | Load `curator_platform_ids` per title |
| migration `0028` | supabase/migrations | Add `content_titles.curator_platform_ids uuid[]` |

## Data Models

### `content_titles` (migration 0028 — additive)

```sql
alter table content_titles
  add column if not exists curator_platform_ids uuid[] not null default '{}';
```

- **Type choice — `uuid[]` column vs. join table.** A separate
  `content_title_platforms (content_id, title_id, platform_id)` join table is the
  textbook normalised option, but the declared set per `(clip, title)` is small
  (typically 1–3 platforms), is always read and written **wholesale** alongside
  the link row (the Confirm_Availability_Step edits the whole set; publish/edit
  rewrites the whole `content_titles` row set), and needs no independent querying
  ("which clips declare platform X?" is not a product need). The array column
  keeps the data co-located with the link it belongs to, requires **zero** new
  RLS (it rides `content_titles`'s existing owner-scoped insert/delete and public
  read-for-live policies), and adds **no** new table/grants. We therefore choose
  the **array column**. If a future need to query by platform arises, a GIN index
  on the array (`using gin (curator_platform_ids)`) or a later join-table
  migration remains possible without breaking this design.
- **Defaults / backfill:** `not null default '{}'` means every existing row is
  immediately valid with an empty declaration set — **no backfill**, no behaviour
  change for existing clips (empty declared ∪ TMDB = TMDB, the backward-compat
  property).
- **Referential note:** array elements are `platforms.id` values. Postgres array
  columns cannot carry an element-level FK; this is acceptable because (a) ids are
  written only from the active Platform_Catalog chips, and (b) the resolver
  resolves ids against the live catalog at read time and silently drops ids with
  no catalog match (Req 4.6 defensiveness), so a later-deactivated platform never
  breaks resolution.
- **Separation (Req 3.2):** this column is distinct from `titles.providers`; a
  TMDB refresh writes `titles.providers` and never touches `content_titles`
  (Req 3.3). Two clips linking the same title hold independent
  `curator_platform_ids` on their own `content_titles` rows (Req 3.4).
- **Identifier persistence (Req 3.5):** platforms are stored by Platform_Catalog
  id (`uuid`), not by name.

### RLS (no new policy required)

`content_titles` already has (migration 0014):
- `content_titles_read` — public read for links of a **live** clip, owner read
  always. The new column is returned by the same `select`, so guests and the
  owner read declarations through the **existing** clip read paths and through
  `get_shared_stack` (which selects from `content_titles` server-side under
  `security definer`). No read policy change.
- `content_titles_insert_own` / `content_titles_delete_own` — writes scoped to the
  clip owner. The Confirm_Availability_Step and edit flow write via the owner's
  session, so the new column is covered. No write policy change.

`get_shared_stack` (migration 0023) does not currently select `content_titles`
per clip (it returns a single `title`/`platform` per item); shared-stack Watch It
uses the same client resolver path via `ssMapContentRowsToClips`, so no RPC change
is required for this feature. (If per-title declarations are later wanted inside
shared-stack payloads, that is an additive RPC change, out of scope here.)

### In-memory shapes

- **Per-title sheet input** (built by `_ssFetchSheetTitles`):
  `{ name, year, providers: {<region>: TmdbEntry[]}, declaredPlatforms: {<region>: CatalogPlatform[]}, curatorPlat? }`.
- **`CatalogPlatform`:** `{ platform_id, name, color, abbr }`.
- **`Watch_Option`** (resolver output, **unchanged shape** — Req 5.3):
  `{ name, color, label, sub, included, platform_id }`.
- **`draft.selectedTitles[i]`:** existing `{ id, name, year, poster_url, tmdb_id, meta }`
  plus `curatorPlatformIds: string[]`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system
should do. Properties serve as the bridge between human-readable specifications and
machine-verifiable correctness guarantees.*

The Watch_It_Resolver (`ssResolveWatchOptions` + `ssResolveWatchOptionsForTitles`)
is a pure function pair with a large input space (arbitrary region-keyed TMDB
provider lists, arbitrary curator-declared platform lists, arbitrary subscription
sets) and clear universal behaviours (set union, de-duplication, ordering
invariants, totality). It is exactly the kind of logic property-based testing
validates well, so the merge core is property-tested with `fast-check` under the
existing `tests/_pbt.js` convention.

The prework folded redundant criteria together (4.3/4.4 into the union property;
1.2/1.3 into the message biconditional; 5.1/5.3 into the shape property; 6.1/6.3
into subscription marking) so each property below carries unique validation value.
Declarative/UI and persistence criteria (Req 2.x display, 3.x storage, 8.x edit
UI, 9.x sacred rules) are verified manually/on-device — see Testing Strategy — and
are not property-tested.

### Property 1: Merge is a set union (every source platform appears)

*For any* clip, region, TMDB provider list, and curator-declared platform list,
the resolved options contain every TMDB provider for that region and every
curator-declared platform for that region (keyed by `platform_id`, else
normalized name), and contain no platform that is in neither source.

**Validates: Requirements 1.1, 4.1, 4.3, 4.4**

### Property 2: De-duplication (a platform in both appears exactly once)

*For any* clip whose TMDB providers and curator-declared platforms share a
platform (same `platform_id`, or same normalized name when ids are absent), that
platform appears as exactly one Watch_Option in the resolved list.

**Validates: Requirements 4.2**

### Property 3: Never dead-end; message is exactly the empty-both case

*For any* clip and region, the resolver returns a non-empty option list with
`message === null` whenever the curator declared at least one platform for the
region (regardless of TMDB), and returns `options: []` with the neutral "Not
available to stream in your region" message **if and only if** both the TMDB
providers and the curator-declared platforms are empty for the region.

**Validates: Requirements 1.2, 1.3**

### Property 4: Curator-declared options share the TMDB option shape and fields

*For any* curator-declared platform resolved into a Watch_Option, the option has
exactly the field set `{ name, color, label, sub, included, platform_id }` with the
same value rules as a TMDB-sourced option (`name`/`color`/`label`/`platform_id`
derived from the matching Platform_Catalog entry, neutral colour default when the
catalog entry has none), so every option in the merged list is shape-identical
regardless of source.

**Validates: Requirements 5.1, 5.3**

### Property 5: Subscription marking is source-independent

*For any* resolved option and any subscription set, the option's `included` flag
is true **if and only if** its `platform_id` is present in the subscription set;
when subscription data is empty or unavailable, every option is rendered as a
standard option (`included: false`) — identically for curator-declared and
TMDB-sourced options.

**Validates: Requirements 6.1, 6.3**

### Property 6: In_Your_Plan options are ordered first

*For any* resolved option list, no option with `included: false` precedes an
option with `included: true`, regardless of whether each option is TMDB-sourced or
curator-declared.

**Validates: Requirements 6.2**

### Property 7: Region-scoped resolution

*For any* clip carrying TMDB providers and curator-declared platforms across
multiple regions, resolving for region R produces options derived only from R's
TMDB providers and R's curator-declared platforms (no platform unique to another
region appears).

**Validates: Requirements 7.1**

### Property 8: Region defaults to IN

*For any* clip and subscription set, resolving with a falsy region (`null`,
`undefined`, or `''`) produces the same result as resolving with region `'IN'`.

**Validates: Requirements 7.2**

### Property 9: Total and defensive (never throws)

*For any* input — including null/undefined/malformed clip, `providers`,
`declaredPlatforms`, individual entries, region, or subscription set — both
`ssResolveWatchOptions` and `ssResolveWatchOptionsForTitles` resolve without
throwing and return a well-formed result (`{ options, fallback, message }`, and an
array of such sections of length equal to the input titles array, respectively).

**Validates: Requirements 4.6**

### Property 10: Backward compatibility (no declarations ⇒ today's behaviour)

*For any* clip with no curator-declared platforms (`declaredPlatforms` empty or
absent and no legacy `curatorPlat`), `ssResolveWatchOptions` returns exactly the
legacy result: the TMDB region providers mapped to options when present, otherwise
the neutral "Not available" message. (Regression guard for the redesign.)

**Validates: Requirements 1.3, 4.1**

### Property 11: Multi-title wrapper resolves each title independently, in order

*For any* array of title-like inputs, `ssResolveWatchOptionsForTitles` returns one
section per input title in input order, where each section's
`{ options, fallback, message }` deep-equals
`ssResolveWatchOptions(titles[i], region, subs)`.

**Validates: Requirements 4.5**

## Error Handling

| Failure | Surface | Handling |
|---|---|---|
| Missing/null/malformed `clip`, `providers`, `declaredPlatforms`, region, or subs | Resolver | Guarded access; resolve to neutral branch or empty section. Never throws (Property 9, Req 4.6). |
| Declared `platform_id` with no live catalog match | `_ssFetchSheetTitles` resolution | `catalog[id]` is `undefined` → filtered out (`.filter(Boolean)`); the rest resolve normally. A deactivated platform silently drops, never errors. |
| `content_titles` fetch error / no rows | `_ssFetchSheetTitles` | Existing graceful single-title fallback (built from the clip itself); declarations simply absent → resolves as today. |
| Platform_Catalog load fails | `_ssPlatformCatalogMap` | Returns empty map (best-effort, like `ssGetSubscribedPlatformIds`); declared ids unresolved → omitted; TMDB providers still resolve. No throw. |
| `upPlatformCatalog` not yet loaded in upload | Confirm_Availability_Step | Existing "Loading platforms…" placeholder; chips appear once `upEnsurePlatformCatalog()` resolves. |
| `content_titles` insert/update partial failure on publish/edit | publish / saveEdit | Existing pattern retained: the content row is already persisted; a link error surfaces a non-fatal toast ("…couldn't link/update all titles — you can edit") and the curator can re-save. The new column rides the same insert, so it shares this handling. |
| Migration applied but column missing on a stale client read | `_ssFetchSheetTitles` select | `curator_platform_ids` simply returns `undefined` → treated as `[]`; resolver behaves as today. Forward/backward safe. |

Guiding rule (unchanged from the codebase): the resolver and sheet builders are
**fail-soft** — a missing or malformed declaration degrades to "TMDB-only / today's
behaviour", never to a thrown error or a false dead-end.

## Testing Strategy

### Property-based tests (pure resolver core)

PBT **is** appropriate here: the merge/de-dup/ordering/region logic is a pure
function over a large input space. Following the existing convention
(`tests/_pbt.js`, `fast-check`, dual-export, one property per `tests/prop-*.test.js`
file, `installDomStub()` before `require('../showshak-shared.js')`, `{ numRuns: ITER }`
with `ITER = 200`):

- One test file per property (Properties 1–11), tagged with the exact comment form:
  `// Feature: watch-it-curator-availability, Property <n>: <text>` plus the
  `// **Validates: Requirements X.Y**` line.
- Generators must cover: empty/non-empty TMDB lists; empty/non-empty declared
  lists; overlapping platforms (same id, and same normalized name with absent
  ids); multiple regions; subscription sets that do/don't contain declared ids;
  and the malformed/null inputs for Property 9 (null clip, non-object providers,
  null entries, missing `platform_id`, non-string region, non-Set subs).
- Each property test runs ≥ 100 iterations (ITER = 200) and references its design
  property.
- All new files are auto-discovered by `tests/run-all.js`; `node tests/run-all.js`
  must stay green, including the existing `ssResolveWatchOptions` / `ssBuildTitleLinks`
  / `ssCanPublish` / pitch property tests (the resolver redesign must not regress
  them — Property 10 is the explicit guard).

### Unit / example tests (pure helpers)

A small number of example-based assertions inside the property files (as the
existing `prop-pitch.test.js` does) pin concrete boundaries: a clip with only a
legacy `curatorPlat` (no `declaredPlatforms`) resolves to the single-option
fallback; a platform in both sources by `platform_id` collapses to one option with
`included` OR-ed; falsy region equals `'IN'`.

### Manual / on-device verification (UI + persistence)

Not property-tested (declarative UI, DB wiring, sacred rules):

- **Req 2.x** — Confirm_Availability_Step renders resolved availability and the
  always-available chip control per title (TMDB and manual paths), add/remove,
  multi-title independence, chips sourced from active catalog.
- **Req 3.x** — `content_titles.curator_platform_ids` holds ids per `(clip, title)`;
  separate from `titles.providers`; a TMDB refresh leaves declarations untouched;
  two clips on the same title stay independent. Verified via SQL spot-check and
  on-device publish.
- **Req 5.2** — tapping a curator-declared option opens via `ssPlatformWatchUrl`
  exactly like a TMDB option (shape parity is covered by Property 4).
- **Req 8.x** — edit-after-post loads current declarations per title, allows
  add/remove on an owned clip (RLS owner-scope), and persists on save so later
  Watch It reflects the change.
- **Req 9.x** — title hidden on the clip body, confirm step confined to upload,
  Watch It shows no scoreboard.

### Migration verification (founder-run)

`0028` is applied in the Supabase SQL editor (founder-run, additive, idempotent
via `add column if not exists … default '{}'`). Verify: column exists, type
`uuid[]`, default `{}`, existing rows readable with empty arrays, and existing RLS
policies still cover read/insert/delete (no new policy). No backfill.

## Files Changed

- `supabase/migrations/0028_content_title_curator_platforms.sql` — **NEW**, founder-run:
  `alter table content_titles add column if not exists curator_platform_ids uuid[] not null default '{}'` + `notify pgrst, 'reload schema'`.
- `showshak-shared.js`:
  - Redesign `ssResolveWatchOptions` to merge TMDB ∪ declared (de-dup, order,
    message-only-when-both-empty, legacy `curatorPlat` honoured).
  - `_ssFetchSheetTitles` — select `curator_platform_ids`, build per-title
    `declaredPlatforms` via the catalog map.
  - Add `_ssPlatformCatalogMap` (impure, memoized; not in the pure export block).
  - `ssResolveWatchOptionsForTitles`, `ssMapContentRowsToClips` — unchanged
    (inherit/keep legacy behaviour); dual-export block unchanged for the resolver
    names (already exported).
- `showshak-upload.html`:
  - `draft.selectedTitles[i].curatorPlatformIds` state.
  - Confirm_Availability_Step UI (per-title resolved availability + chips), reusing
    `upPlatformCatalog` / `upToggleManualPlat` styling.
  - `upPickTmdb` / `upSubmitManual` route platform picks into `curatorPlatformIds`.
  - publish / `saveDraft` / `saveEdit` link-row builders include `curator_platform_ids`.
  - `enterEditMode` selects `curator_platform_ids` and attaches per title.
- `tests/prop-watch-merge-*.test.js` (and siblings) — **NEW** property tests
  (Properties 1–11), one per file, auto-discovered by `tests/run-all.js`.

## Phasing / Sequencing

1. **Phase 1 — Pure resolver + migration (foundation, independently shippable).**
   Apply migration `0028`. Redesign `ssResolveWatchOptions` for the merge and add
   the per-title `declaredPlatforms` plumbing in `_ssFetchSheetTitles` +
   `_ssPlatformCatalogMap`. Write Properties 1–11 and keep `node tests/run-all.js`
   green (Property 10 guards backward compatibility, so this phase is safe to ship
   before any UI exists — clips with no declarations behave exactly as today).
2. **Phase 2 — Upload Confirm_Availability_Step.** Add `curatorPlatformIds` draft
   state, the per-title chip UI, reconcile the manual path, and wire publish /
   saveDraft to write `curator_platform_ids`. Now curators can declare platforms;
   the Phase-1 resolver immediately starts merging them.
3. **Phase 3 — Edit-after-post.** Load `curator_platform_ids` in `enterEditMode`,
   reuse the chip UI, and persist via `saveEdit`. Closes Req 8.

Each phase is independently verifiable: Phase 1 by the property suite + migration
check, Phases 2–3 by on-device walkthroughs.
