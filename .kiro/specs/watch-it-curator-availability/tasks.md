# Implementation Plan

## Overview

One principle ships in three independently-shippable, dependency-ordered phases —
**TMDB is a hint, the curator is the authority.** **Phase 1 (pure resolver + migration)
is the priority**: it redesigns `ssResolveWatchOptions` to *merge* TMDB providers with
curator-declared platforms (de-dup, order, message-only-when-both-empty) and adds the
per-title `declaredPlatforms` plumbing. Phase 1 is backward-compatible — a clip with no
declarations resolves exactly as today (TMDB ∪ ∅ = TMDB) — so it is safe to ship before
any UI exists. Phase 2 adds the upload Confirm_Availability_Step that lets curators
declare platforms (the Phase-1 resolver immediately starts merging them); Phase 3 adds
edit-after-post.

Conventions (matching the existing repo + the `pwa-black-screen-load` plan): all pure
logic lives in `showshak-shared.js`, dual-exported (`window.*` + `module.exports`); each
correctness property gets its own `tests/prop-*.test.js` fast-check file
(`installDomStub()` before `require('../showshak-shared.js')`, `{ numRuns: ITER }` with
`ITER = 200`), auto-discovered by `tests/run-all.js`. Run `node tests/run-all.js` after
every `showshak-shared.js` change; the suite — **including the existing
`ssResolveWatchOptions` / `ssResolveWatchOptionsForTitles` tests
(`tests/prop-watch-multi.test.js`)** — MUST stay green. **TDD-leaning:** the 11 property
tests for the redesigned resolver are written FIRST (they encode merge / dedup /
never-dead-end / shape parity / backward-compat behaviour), then the merge is implemented
to make them pass. **Property 10 (backward compatibility) is the critical regression
guard.** Pure vanilla HTML/CSS/JS, no build step. The single migration (`0028`) is
**founder-run**; the resolver and plumbing are backward-safe if the column is not present
yet (a stale-client read returns `undefined` → treated as `[]` → today's behaviour).

## Tasks

### PHASE 1 — Pure resolver + migration (FOUNDATION — priority; backward-compatible, ship alone)

- [x] 1. Write migration `0028` to store curator-declared platforms per (clip, title)
  - Create `supabase/migrations/0028_content_title_curator_platforms.sql` (additive,
    idempotent): `alter table content_titles add column if not exists curator_platform_ids
    uuid[] not null default '{}';` followed by `notify pgrst, 'reload schema';`.
  - No backfill, no new RLS policy — the column rides `content_titles`' existing
    owner-scoped insert/delete and public-read-for-live policies (migration 0014).
  - **FOUNDER-RUN to apply** (see task 5): this task only authors the SQL file; applying
    it in the Supabase SQL editor is a founder step. The resolver/plumbing in task 3 MUST
    be backward-safe if the column is not present yet (stale read → `undefined` → `[]`).
  - _Files: supabase/migrations/0028_content_title_curator_platforms.sql_
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 2. Write the 11 property tests for the redesigned resolver (TDD — author FIRST, before task 3)
  - **IMPORTANT**: These encode the target merge behaviour and are EXPECTED to fail (or be
    red) until the merge in task 3 lands. Author each as its own
    `tests/prop-watch-merge-*.test.js` file (fast-check; `installDomStub()` before
    `require('../showshak-shared.js')`; `{ numRuns: ITER }` with `ITER = 200`; tagged
    `// Feature: watch-it-curator-availability, Property <n>: <text>` +
    `// **Validates: Requirements X.Y**`). Wire each into `tests/run-all.js` via
    auto-discovery and run `node tests/run-all.js`.
  - Generators must cover: empty/non-empty TMDB lists; empty/non-empty declared lists;
    overlapping platforms (same `platform_id`, and same normalized name with absent ids);
    multiple regions; subscription sets that do/don't contain declared ids; and the
    malformed/null inputs for Property 9.

  - [x] 2.1 Property 1 — Merge is a set union (every source platform appears)
    - `tests/prop-watch-merge-union.test.js`: for any clip/region/TMDB list/declared list,
      resolved options contain every TMDB provider and every declared platform for that
      region (keyed by `platform_id`, else normalized name), and no platform in neither.
    - **Property 1: Merge is a set union**
    - **Validates: Requirements 1.1, 4.1, 4.3, 4.4**
    - _Files: tests/prop-watch-merge-union.test.js, tests/run-all.js_

  - [x] 2.2 Property 2 — De-duplication (a platform in both appears exactly once)
    - `tests/prop-watch-merge-dedup.test.js`: a platform shared by TMDB and declared (same
      `platform_id`, or same normalized name when ids absent) yields exactly one option,
      with `included` OR-ed across sources.
    - **Property 2: De-duplication**
    - **Validates: Requirements 4.2**
    - _Files: tests/prop-watch-merge-dedup.test.js, tests/run-all.js_

  - [x] 2.3 Property 3 — Never dead-end; message is exactly the empty-both case
    - `tests/prop-watch-merge-message.test.js`: non-empty options with `message === null`
      whenever the curator declared ≥1 platform for the region (regardless of TMDB);
      `options: []` with the neutral "Not available to stream in your region" message **iff**
      both TMDB and declared are empty for the region (biconditional).
    - **Property 3: Never dead-end; message biconditional**
    - **Validates: Requirements 1.2, 1.3**
    - _Files: tests/prop-watch-merge-message.test.js, tests/run-all.js_

  - [x] 2.4 Property 4 — Curator-declared options share the TMDB option shape and fields
    - `tests/prop-watch-merge-shape.test.js`: every declared-sourced option has exactly
      `{ name, color, label, sub, included, platform_id }` with the same value rules as a
      TMDB-sourced option (catalog-derived `name`/`color`/`label`/`platform_id`, neutral
      colour default), so the merged list is shape-identical regardless of source.
    - **Property 4: Option-shape parity**
    - **Validates: Requirements 5.1, 5.3**
    - _Files: tests/prop-watch-merge-shape.test.js, tests/run-all.js_

  - [x] 2.5 Property 5 — Subscription marking is source-independent
    - `tests/prop-watch-merge-subscription.test.js`: an option's `included` is true **iff**
      its `platform_id` is in the subscription set; empty/unavailable subs → every option
      `included: false` — identically for declared and TMDB options.
    - **Property 5: Source-independent subscription marking**
    - **Validates: Requirements 6.1, 6.3**
    - _Files: tests/prop-watch-merge-subscription.test.js, tests/run-all.js_

  - [x] 2.6 Property 6 — In_Your_Plan options are ordered first
    - `tests/prop-watch-merge-order.test.js`: no `included: false` option precedes an
      `included: true` option, regardless of source (stable sort preserves
      TMDB-then-declared insertion order within each group).
    - **Property 6: In_Your_Plan ordering**
    - **Validates: Requirements 6.2**
    - _Files: tests/prop-watch-merge-order.test.js, tests/run-all.js_

  - [x] 2.7 Property 7 — Region-scoped resolution
    - `tests/prop-watch-merge-region.test.js`: for a clip carrying TMDB + declared across
      multiple regions, resolving for region R produces options derived only from R's TMDB
      and R's declared platforms (no platform unique to another region appears).
    - **Property 7: Region scoping**
    - **Validates: Requirements 7.1**
    - _Files: tests/prop-watch-merge-region.test.js, tests/run-all.js_

  - [x] 2.8 Property 8 — Region defaults to IN
    - `tests/prop-watch-merge-region-default.test.js`: resolving with a falsy region
      (`null`/`undefined`/`''`) deep-equals resolving with `'IN'`.
    - **Property 8: IN default**
    - **Validates: Requirements 7.2**
    - _Files: tests/prop-watch-merge-region-default.test.js, tests/run-all.js_

  - [x] 2.9 Property 9 — Total and defensive (never throws)
    - `tests/prop-watch-merge-total.test.js`: for any input — null/undefined/malformed
      clip, `providers`, `declaredPlatforms`, entries, region, or subs — both
      `ssResolveWatchOptions` and `ssResolveWatchOptionsForTitles` resolve without throwing
      and return a well-formed result (`{ options, fallback, message }`; and an array of
      such sections of length === input titles length, respectively).
    - **Property 9: Totality / defensiveness**
    - **Validates: Requirements 4.6**
    - _Files: tests/prop-watch-merge-total.test.js, tests/run-all.js_

  - [x] 2.10 Property 10 — Backward compatibility (no declarations ⇒ today's behaviour) — CRITICAL GUARD
    - `tests/prop-watch-merge-backcompat.test.js`: for any clip with no declared platforms
      (`declaredPlatforms` empty/absent and no legacy `curatorPlat`), `ssResolveWatchOptions`
      returns exactly the legacy result — TMDB region providers mapped to options when
      present, else the neutral "Not available" message. This is the explicit regression
      guard for the redesign and complements the existing `tests/prop-watch-multi.test.js`
      staying green.
    - **Property 10: Backward compatibility**
    - **Validates: Requirements 1.3, 4.1**
    - _Files: tests/prop-watch-merge-backcompat.test.js, tests/run-all.js_

  - [x] 2.11 Property 11 — Multi-title wrapper resolves each title independently, in order
    - `tests/prop-watch-merge-multititle.test.js`: for any array of title-like inputs,
      `ssResolveWatchOptionsForTitles` returns one section per input title in order, where
      each section's `{ options, fallback, message }` deep-equals
      `ssResolveWatchOptions(titles[i], region, subs)`.
    - **Property 11: Multi-title independence**
    - **Validates: Requirements 4.5**
    - _Files: tests/prop-watch-merge-multititle.test.js, tests/run-all.js_

- [x] 3. Implement the merge resolver + per-title `declaredPlatforms` plumbing (make Properties 1–11 pass)

  - [x] 3.1 Redesign `ssResolveWatchOptions(clip, region, subscribedPlatformIds)` as a merge
    - Replace the all-or-nothing fallback chain with `Merged_Availability` = the
      de-duplicated **union** of (a) `clip.providers[region]` (TMDB) and (b)
      `clip.declaredPlatforms[region]` (NEW region-keyed
      `Array<{ platform_id, name, color, abbr }>`). When `declaredPlatforms[region]` is
      empty and a legacy `clip.curatorPlat` exists, treat it as one declared platform for
      the region (backward compat).
    - Map both sources to the **identical** option shape
      `{ name, color, label, sub, included, platform_id }` using the existing field rules.
      De-dup by `_ssDedupKey(option)` = `platform_id` else `normalizeName(name)` (local copy
      of the existing normalisation); iterate TMDB first then declared so a shared platform
      yields exactly one option; OR the dropped duplicate's `included` into the kept option.
      Stable-sort `included:true` first. Non-empty → `{ options, fallback, message: null }`
      (`fallback` true iff no TMDB providers for the region); both empty →
      `{ options: [], fallback: true, message: 'Not available to stream in your region' }`.
    - Keep PURE: no DOM/network; guard every access; never throw on missing/null/malformed
      input (Property 9). Keep `ssResolveWatchOptions` / `ssResolveWatchOptionsForTitles`
      dual-exported under their existing names (`module.exports.*` + `window.*`);
      `ssResolveWatchOptionsForTitles` and `ssMapContentRowsToClips` keep their contract
      (the wrapper inherits the merge per title; `ssMapContentRowsToClips` keeps the legacy
      `curatorPlat`).
    - _Files: showshak-shared.js, tests/prop-watch-merge-*.test.js_
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 4.6_

  - [x] 3.2 Add `_ssPlatformCatalogMap()` — memoized impure catalog loader (NOT in the pure export block)
    - Best-effort, fire-and-forget loader (mirroring `ssGetSubscribedPlatformIds`'s
      memoization) that fetches `platforms (id, name, color, abbr)` once and caches an
      `{ id → { platform_id, name, color, abbr } }` map. On failure returns an empty map
      (no throw). It lives beside the other impure sheet helpers — the PURE resolver never
      calls it; resolved `declaredPlatforms` is handed in as data.
    - _Files: showshak-shared.js_
    - _Requirements: 5.1, 7.1, 4.6_

  - [x] 3.3 Plumb `declaredPlatforms` into `_ssFetchSheetTitles(show)`
    - Extend the `content_titles` select to
      `sort_no, curator_platform_ids, titles:title_id ( id, name, year, providers )` ordered
      by `sort_no`. For each title build
      `declaredPlatforms = { [region]: ids.map(id => catalog[id]).filter(Boolean) }` using
      `_ssPlatformCatalogMap()` and the curator's region (`IN` default). Ids with no catalog
      match silently drop. Keep the single-title fallback (mock/demo/Discover/fetch-error)
      working — carry `declaredPlatforms` derived from legacy `curatorPlat` when present,
      else omit (identical to today). Never throw; keep caching into `_ssSheetTitlesCache`.
    - **Backward-safe**: if `curator_platform_ids` is absent (column not yet applied), the
      select returns `undefined` → treated as `[]` → today's behaviour.
    - _Files: showshak-shared.js_
    - _Requirements: 7.1, 4.6, 3.2_

  - [x] 3.4 Verify all 11 new property tests pass AND the existing suite stays green
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests. Run
      `node tests/run-all.js`.
    - **EXPECTED OUTCOME**: `prop-watch-merge-*` (Properties 1–11) PASS, and the pre-existing
      resolver tests `tests/prop-watch-multi.test.js` + all other `tests/prop-*.test.js` and
      `tests/feed-cache.test.js` still PASS (Property 10 + the existing tests are the
      backward-compat regression guard).
    - _Files: tests/prop-watch-merge-*.test.js, tests/prop-watch-multi.test.js, tests/run-all.js_
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2_

- [x] 4. Phase 1 checkpoint — keep the suite green
  - Run `node tests/run-all.js`; the full pure-logic suite (existing + the 11
    `prop-watch-merge-*` files) MUST be green. Ensure all tests pass, ask the user if
    questions arise.
  - _Requirements: 4.6_

- [x] 5. Phase 1 founder-run — apply migration `0028` + verify (FOUNDER-RUN)
  - **Founder applies `0028_content_title_curator_platforms.sql` in the Supabase SQL editor**
    (additive, idempotent). Verify: column `content_titles.curator_platform_ids` exists, type
    `uuid[]`, default `{}`, existing rows readable with empty arrays, and the existing RLS
    policies (read/insert/delete) still cover it (no new policy). No backfill.
  - Phase 1 is backward-compatible and independently shippable — clips with no declarations
    behave exactly as today. Confirm before starting Phase 2.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

### PHASE 2 — Upload Confirm_Availability_Step (after Phase 1; lets curators declare platforms)

- [x] 6. Add the Confirm_Availability_Step to the upload flow and wire the persist path

  - [x] 6.1 Add `curatorPlatformIds` to draft state
    - `draft.selectedTitles[i]` gains `curatorPlatformIds: string[]` (Platform_Catalog ids),
      defaulting to `[]`. Ensure it survives `ssRowToDraft` / draft serialization round-trips
      alongside the existing `{ id, name, year, poster_url, tmdb_id, meta }` fields.
    - _Files: showshak-upload.html_
    - _Requirements: 3.5_

  - [x] 6.2 Render the per-title Confirm_Availability_Step (resolved availability + chips)
    - After a title is selected, per linked title: call the pure
      `ssResolveWatchOptions({ providers: title.providers, declaredPlatforms: {...} }, region,
      new Set())` for the curator's region and show the resolved platform names ("Streams on:
      …"); when the result carries `message` (both sources empty) show "We couldn't confirm
      where this streams — add the platforms below." (Req 2.2). Render the always-available
      add/correct chip control from `upPlatformCatalog` (active catalog via
      `upEnsurePlatformCatalog()`, reusing `upToggleManualPlat` styling); selected chips =
      `draft.selectedTitles[i].curatorPlatformIds`; toggling off removes (Req 2.3, 2.4, 2.6).
      One independent chip block per `draft.selectedTitles` entry (Req 2.5). Confine all
      title/platform display to the upload flow (Req 9.2).
    - _Files: showshak-upload.html_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.2_

  - [x] 6.3 Reconcile the manual path onto the same mechanism
    - Route `upSubmitManual`'s chip selection into the new title's
      `draft.selectedTitles[i].curatorPlatformIds` (per `(clip, title)`), so the manual and
      TMDB (`upPickTmdb`) paths use the **same** field and the same publish write — the
      per-`(clip, title)` declaration is the authority, not the shared `titles.providers`
      cache (Req 3.2, 3.4). The edge-function `manual` mode may still create the title row;
      the resolver de-dups by `platform_id` so any residual providers-baking is harmless.
    - _Files: showshak-upload.html_
    - _Requirements: 2.3, 3.2, 3.4_

  - [x] 6.4 Include `curator_platform_ids` in publish / saveDraft link-row writes
    - In the three `content_titles` insert sites (draft save, publish-fresh,
      publish-from-draft) extend the link-row builder to set
      `curator_platform_ids: (resolvedTitleFor(l.title_id).curatorPlatformIds || [])`, mapping
      `ssBuildTitleLinks`' `{title_id, sort_no}` back to its `selectedTitles` entry. Direct
      `from('content_titles').insert(...)` (owner-scoped by existing RLS); no RPC.
    - _Files: showshak-upload.html_
    - _Requirements: 3.1, 3.2, 3.5_

- [~] 7. Phase 2 founder-run on-device verification (FOUNDER-RUN)
  - **Founder runs this on the installed PWA on a real device.** Select a TMDB-linked title
    and a manual title: confirm the step shows resolved region availability (or the
    couldn't-confirm message), the chip control adds/removes platforms per title
    independently, chips come only from the active catalog; publish and re-open Watch It and
    confirm declared platforms now appear (merged with TMDB). SQL spot-check
    `content_titles.curator_platform_ids` holds the ids per `(clip, title)`, separate from
    `titles.providers`, and two clips on the same title stay independent.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 5.2, 9.1, 9.2, 9.3_

### PHASE 3 — Edit-after-post (after Phase 2; closes Req 8)

- [x] 8. Load, edit, and persist curator declarations in the Edit_Flow

  - [x] 8.1 Load `curator_platform_ids` per title in `enterEditMode`
    - Extend the `content_titles` fetch in `enterEditMode(contentId)` to
      `.select('title_id, sort_no, curator_platform_ids')`. After `ssRowToDraft` rebuilds
      `selectedTitles` and the re-fetch restores names/posters, attach
      `curatorPlatformIds = link.curator_platform_ids || []` to the matching entry by
      `title_id` (Req 8.1).
    - **Backward-safe**: missing column → `undefined` → `[]`.
    - _Files: showshak-upload.html_
    - _Requirements: 8.1_

  - [x] 8.2 Reuse the Confirm_Availability_Step chip UI in edit
    - Render the same per-title resolved-availability + chip control (from task 6.2) inside
      the edit flow so the curator can add/remove `curatorPlatformIds` per linked title on an
      owned clip (Req 8.2). No new UI — reuse the Phase-2 component.
    - _Files: showshak-upload.html_
    - _Requirements: 8.2_

  - [x] 8.3 Persist edited declarations in `saveEdit`
    - `saveEdit`'s existing delete-then-insert of `content_titles` now includes
      `curator_platform_ids` on the inserted rows (reusing the task-6.4 link-row builder), so
      subsequent Watch It resolutions reflect the change (Req 8.3).
    - _Files: showshak-upload.html_
    - _Requirements: 8.3_

- [~] 9. Phase 3 founder-run on-device verification (FOUNDER-RUN)
  - **Founder runs this on the installed PWA on a real device.** Open Edit on an owned
    published clip: confirm current declarations load per title, add/remove works per title,
    save persists, and re-opening Watch It reflects the edited platforms (merged with TMDB).
    Confirm a non-owner cannot edit (existing RLS owner-scope). Title stays hidden on the clip
    body; Watch It shows no scoreboard.
  - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"], "dependsOn": [] },
    { "wave": 2, "tasks": ["3"], "dependsOn": ["2"] },
    { "wave": 3, "tasks": ["4"], "dependsOn": ["3"] },
    { "wave": 4, "tasks": ["5"], "dependsOn": ["1", "4"] },
    { "wave": 5, "tasks": ["6"], "dependsOn": ["5"] },
    { "wave": 6, "tasks": ["7"], "dependsOn": ["6"] },
    { "wave": 7, "tasks": ["8"], "dependsOn": ["7"] },
    { "wave": 8, "tasks": ["9"], "dependsOn": ["8"] }
  ]
}
```

```
PHASE 1 (priority — backward-compatible; ship alone)
  1 (migration 0028 SQL file)      2 (write Properties 1–11 — TDD, fail-first)
            └───────────────┬──────────────┘
                            ▼
                3 ─ 3.1 → 3.2 → 3.3 → 3.4 (implement merge; make 1–11 + existing suite green)
                            ▼
                4 (checkpoint: suite green)
                            ▼
                5 (FOUNDER-RUN: apply 0028 + verify)  ◄─ also gated by 1
                            ▼  (Phase 1 shipped & verified)
PHASE 2 (after Phase 1)
                6 ─ 6.1 → 6.2 → 6.3 → 6.4 (Confirm_Availability_Step + persist wiring)
                            ▼
                7 (FOUNDER-RUN on-device)
                            ▼  (Phase 2 shipped & verified)
PHASE 3 (after Phase 2)
                8 ─ 8.1 → 8.2 → 8.3 (edit-after-post load/edit/persist)
                            ▼
                9 (FOUNDER-RUN on-device)
```

- Wave 1 runs the migration-file authoring (task 1) and the TDD property tests (task 2) in
  parallel — neither depends on the other. Task 3's merge implementation depends on the
  tests existing (task 2). Task 5's founder-run apply is gated by both the SQL file (task 1)
  and a green suite (task 4).
- Phases are strictly sequential and each is independently shippable: task 5 (Phase 1
  shipped) gates Phase 2; task 7 (Phase 2 shipped) gates Phase 3. **Phase 1 is the priority.**

## Notes

- **TDD-leaning**: the 11 `prop-watch-merge-*` files (task 2) are written FIRST and are
  red until the merge in task 3 lands; they encode the union / dedup / never-dead-end /
  shape-parity / region / totality / backward-compat / multi-title behaviour.
- **Property 10 is the critical regression guard** (no declarations ⇒ today's behaviour),
  complemented by the pre-existing `tests/prop-watch-multi.test.js` staying green — together
  they prove the redesign does not regress current Watch It resolution.
- **Pure core stays pure**: `ssResolveWatchOptions` / `ssResolveWatchOptionsForTitles` are
  dual-exported (`window.*` + `module.exports`) with no DOM/network; `_ssPlatformCatalogMap`
  is impure (network) and lives outside the pure export block. Run `node tests/run-all.js`
  after every `showshak-shared.js` change; the suite must stay green.
- **Migration is FOUNDER-RUN** (task 1 authors the SQL; task 5 applies it). The resolver and
  `_ssFetchSheetTitles` plumbing are backward-safe if the column is not present yet — a
  stale-client read returns `undefined`, treated as `[]`, i.e. today's behaviour.
- **Founder-run / on-device verification**: tasks 5, 7, 9 are run by the founder (migration
  apply + real-device Watch It / upload / edit walkthroughs + SQL spot-checks). UI and
  persistence (Req 2.x, 3.x, 8.x, 9.x) are verified there, not by property tests — only the
  pure resolver decisions are property-tested.
- **Catalog dependency**: every selectable platform comes from the verified India
  Platform_Catalog (migration `0027`); refreshing that catalog is out of scope.

## Workflow Complete

This planning workflow is complete — requirements, design, and this task plan are the
artifacts. No implementation has been done. To begin, open
`.kiro/specs/watch-it-curator-availability/tasks.md` and click **Start task** next to a task
item (begin with task 1 in Phase 1).
