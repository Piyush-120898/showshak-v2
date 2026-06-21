# Design Document

## Overview

**Stack Folder View** adds the missing "browse the whole stack" surface to ShowShak and
changes how a stack is *entered*. It builds directly on the shipped **stack-sharing**
feature and introduces **no new database migration** — every byte of data it needs is
already returned by the `get_shared_stack` RPC and surfaced by `ssLoadSharedStackById(id)`.

It delivers four things:

1. **A dedicated route** — `showshak-stack.html?stack=<id>` — a real, deep-linkable page
   with a clean browser back button. It uses the shared chrome (`<div id="ss-nav"></div>`),
   the standard CSS, and `showshak-shared.js`. The header shows the stack name + details +
   the creator's @handle (plus contributor @handles for collaborative stacks); the body is
   a **title-blind grid** of clip cards (creator + 🔥 fires only — no title, no platform
   badge).

2. **A Watchlist preview change** — each stack row shows up to a **fixed cap of 12** clips
   in the existing horizontal scroll, then a **"View All"** tile (only when the stack has
   more than 12 clips) that opens the folder route. The stack name and the header bar also
   open the folder route.

3. **A folder → viewer handoff** — tapping any grid clip opens the universal full-screen
   viewer `ssOpenClip(clip, allStackClips)` starting at the tapped clip, with the whole
   stack as the swipe playlist.

4. **A new share flow + shared-link behavior** — tapping Share first opens a **visibility
   chooser sheet** (options resolved by the new pure `ssShareVisibilityOptions`), persists
   the choice via `ssSetStackVisibility`, then invokes the native share sheet with the
   `?stack=` link and title-blind text. Shared `?stack=<id>` links now **land on the folder
   route** instead of opening the first clip directly; the collaborative auto-join logic
   moves with them.

The design adds **three pure, DOM-free, dual-exported functions** (`ssStackPreviewClips`,
`ssStackContributors`, `ssShareVisibilityOptions`) that are property-tested with fast-check,
and reuses every existing piece: `ssLoadSharedStackById`, `ssOpenClip`, `ssSetStackVisibility`,
`ssStackShareUrl`, `ssResolveMyRole` / `ssIsCuratorAccountSync`, `ssHydrateStacks`, the
`ss_stacks_v1` cache, and the existing grid/card styling from the profile/discover pages.

The sacred rules are preserved end-to-end: **title-blind everywhere** (titles only in the
Watch It sheet), the **RLS + `get_shared_stack` RPC is the only security boundary**, and
**unlisted stacks stay non-enumerable** (reachable only by their UUID link through the RPC).

## Architecture

### New route + changed entry path

```
                          ┌─────────────────────────────────────────────┐
 Watchlist (stack row)    │  showshak-stack.html?stack=<id>   (NEW ROUTE)│
   • name / header bar ──▶│  Stack Folder View                          │
   • "View All" tile  ───▶│   1. read ?stack=<id>                        │
                          │   2. ssLoadSharedStackById(id)  ── RPC ──┐   │
 Shared link              │      → {stack, clips, members,          │   │
   ?stack=<id>        ───▶│         memberCount, viewerIsMember}    │   │
   (now lands here, NOT   │   3. header: name + ssStackContributors │   │
    the first clip)       │   4. grid: title-blind clip cards       │   │
                          │   5. collaborative? → auto-join (moved) │   │
                          └───────────────┬─────────────────────────┘   │
                                          │ tap a clip                   │
                                          ▼                              ▼
                       ssOpenClip(clip, allStackClips)        get_shared_stack(id)
                       (whole stack = swipe playlist)         [SECURITY DEFINER RPC —
                        ← existing universal viewer            the ONLY unlisted read path,
                                                               anon-allowed, no leak]
```

### Shared-link entry: the chosen approach

The current feed `?stack=` handler (in `showshak-feed.html`) opens the first clip directly
via `ssOpenClip(clips[0], clips)` and runs the collaborative auto-join inline. We change
this with the **cleanest possible approach**:

- **`ssStackShareUrl(stack)` is re-pointed** from `…/showshak-feed.html?stack=<id>` to
  `…/showshak-stack.html?stack=<id>`. New share links target the folder route directly.
- **The old feed `?stack=` handler is retired as an entry point but kept as a safety
  redirect** for any link already in the wild: if `showshak-feed.html` loads with a
  `?stack=<id>` param, it immediately `location.replace()`s to
  `showshak-stack.html?stack=<id>` (preserving the id, using `replace` so the back button
  skips the dead hop). The clip-opening + auto-join code is removed from the feed handler;
  its responsibility now lives on the folder route.

This keeps a single source of truth for "what a shared stack does" (the folder route),
makes links deep-linkable and back-button-clean, and guarantees no behavioral fork between
"opened from Watchlist" and "opened from a shared link."

### The share-chooser flow

```
 tap Share (Watchlist row ⋮ or folder header)
   │
   ▼
 ssShareVisibilityOptions(role, currentVisibility)   ← pure: role-gated option list
   │   normal → ['private','unlisted'] ;  curator → ['private','unlisted','public']
   ▼
 visibility chooser sheet  (reusable; mounted on Watchlist + folder route)
   │   user picks a visibility
   ▼
 ssSetStackVisibility(id, vis, highlighted)          ← persist (existing impure helper)
   │
   ├─ chosen 'private'  → do NOT generate a link; close sheet (Req 9.2)
   │
   └─ chosen non-private → ssStackShareUrl(stack)  → navigator.share({title,text,url})
                                                      (clipboard fallback) — title-blind text
```

The interim auto-promote in `ssShareStack` (silently flipping `private → unlisted` on share)
is **removed** and replaced by this explicit chooser (Req 9.1). The same visibility controls
remain in the stack's ⋮ menu (Req 8.6) — the chooser and the ⋮ menu both call the same
`ssSetStackVisibility`.

### Layering

- **Pure logic** (`showshak-shared.js`, DOM-free, dual-exported, fast-check): the three new
  functions plus the existing rules they reuse (`ssIsCuratorAccountSync`-style role check).
- **Impure helpers** (`showshak-shared.js`, window-only): `ssLoadSharedStackById`,
  `ssSetStackVisibility`, `ssStackShareUrl` (re-pointed), `ssJoinStack`, and a new thin
  `ssShareStackWithVisibility(stack, visibility)` that performs the persist-then-native-share
  step after the chooser resolves.
- **DOM / pages**: `showshak-stack.html` (new), `showshak-watchlist.html` (preview cap +
  chooser), `showshak-feed.html` (retire/redirect the `?stack=` handler), and a small shared
  chooser-sheet component.

## Components and Interfaces

### New page — `showshak-stack.html`

A standalone page mirroring the structure of the existing pages (shared chrome, standard CSS,
`showshak-shared.js`). Responsibilities:

| Step | Behavior | Reuses |
| --- | --- | --- |
| Boot | Parse `?stack=<id>` from `location.search`. If absent/invalid → "unavailable" state. | `URLSearchParams` |
| Load | `await ssLoadSharedStackById(id)` → `{stack, clips, members, memberCount, viewerIsMember}` or `null`. | existing impure helper (Req 1.2, 14.1) |
| Header | Render `stack.name` + details (clip count, mode). Build attribution via `ssStackContributors(owner, members)` and render owner-first @handles; collaborative shows the contributor row, view-only shows creator only. | `ssStackContributors` (Req 3) |
| Grid | Render `clips` as title-blind cards (creator + 🔥 fires; **no** title, **no** platform badge). Reuse the profile/discover grid card markup/CSS. | existing grid styles (Req 2) |
| Tap clip | `ssOpenClip(clip, clips)` starting at the tapped clip. | universal viewer (Req 6) |
| Collaborative | If `stack.mode === 'collaborative'` run the relocated auto-join (signed-in, not member, room via `ssCanJoinStack` → `ssJoinStack`). | `ssCanJoinStack`, `ssJoinStack` (Req 7.5) |
| Share | Header Share button → visibility chooser → persist → native share. | chooser sheet + `ssShareStackWithVisibility` (Req 8) |
| Back | Standard browser navigation; the route is a real page so back returns to the prior view. | (Req 1.5) |

The grid card is a title-blind variant of the existing card: it keeps the creator handle and
the 🔥 fires count (`fires_count`) and omits the `.wl-clip-plat` platform badge and any title
text. For collaborative stacks it may show the existing `+ @contributor` attribution chip
(already title-free).

### New pure functions (`showshak-shared.js`)

All three are DOM-free, never throw, and are added to BOTH the `window.*` export block and
the `module.exports` block (dual-export), exactly like the existing stack-sharing rules.

```js
/* Watchlist preview truncation + "View All" flag.
   - clips: array (any length, possibly empty/non-array → treated as []).
   - cap:   positive integer preview cap (non-positive/non-number → SS_STACK_PREVIEW_CAP).
   Returns { shown, viewAll } where:
     shown   = clips.slice(0, min(cap, clips.length))   (order-preserving prefix)
     viewAll = clips.length > cap                        (strictly greater)
   (Req 4.1–4.4, 10.) */
function ssStackPreviewClips(clips, cap) { ... }
var SS_STACK_PREVIEW_CAP = 12;   // fixed preview cap, single source of truth

/* Ordered, de-duplicated attribution list for the folder header.
   - owner:   the stack owner identity ({user_id|id, username} or a bare id/handle).
   - members: members[] from get_shared_stack ([{user_id, role, username}, ...]).
   Returns an ordered list: owner FIRST, then the other members in their given order,
   each identity appearing AT MOST ONCE (owner deduped even if present in members).
   View-only (no other members) → a single-element list containing just the creator.
   (Req 3.1–3.4, 11.) */
function ssStackContributors(owner, members) { ... }

/* Allowed visibility choices for the share chooser, by role.
   - role:              'curator' (or a truthy curator flag) → full set; anything else → normal.
   - currentVisibility: included only to mark/anchor the current selection; never widens the set.
   Returns: normal  → ['private','unlisted']
            curator → ['private','unlisted','public']
   Reuses the same curator rule used by ssStackShelfPlacement / ssIsCuratorAccountSync.
   (Req 8.3, 8.4, 12.) */
function ssShareVisibilityOptions(role, currentVisibility) { ... }
```

Semantics notes:
- `ssStackPreviewClips` returns the *same clip references* in `shown` (no cloning), so the
  Watchlist render and the folder route agree on identity.
- `ssStackContributors` de-dupes by stable identity key (prefer `user_id`/`id`, fall back to
  `username`); the owner is emitted first even if they also appear in `members`.
- `ssShareVisibilityOptions` derives "curator" from the same rule the rest of stack-sharing
  uses (a `'curator'` role string / `ssIsCuratorAccountSync()` truth), so option-gating can
  never disagree with shelf placement or the ⋮ menu's Public visibility.

### Re-pointed / new impure helpers (`showshak-shared.js`)

- **`ssStackShareUrl(stack)`** — change the path segment from `showshak-feed.html?stack=`
  to `showshak-stack.html?stack=`. Still returns `null` for private/mock ids; still never
  includes a title.
- **`ssShareStackWithVisibility(stack, visibility)`** (new, thin) — persist via
  `ssSetStackVisibility(stack.id, visibility, stack.highlighted)`, then, for non-private,
  build the URL via `ssStackShareUrl` and invoke `navigator.share` (clipboard fallback) with
  the existing title-blind `title`/`text`. Replaces the body of the old `ssShareStack`
  auto-promote path.
- **`ssShareStack(stack)`** — repurposed to *open the chooser* (delegating to the sheet)
  rather than auto-promoting. The auto-promote branch is deleted (Req 9.1).

### Shared chooser sheet (reusable)

A small bottom-sheet component (markup + a few CSS rules + a tiny controller) mounted on both
`showshak-watchlist.html` and `showshak-stack.html`. It renders one row per option returned
by `ssShareVisibilityOptions(role, currentVisibility)`, marks the current visibility, and on
selection calls `ssShareStackWithVisibility`. It is intentionally dumb: all option-gating
lives in the pure function; all persistence/share lives in the impure helper.

### Watchlist preview change (`showshak-watchlist.html`)

The stack-row render currently maps **all** `stack.clips` into `.wl-clip` cards. It changes to:

```js
const { shown, viewAll } = ssStackPreviewClips(stack.clips, SS_STACK_PREVIEW_CAP);
const clipsHtml = shown.map(/* existing title-blind .wl-clip markup */).join('');
const viewAllTile = viewAll
  ? `<div class="wl-viewall" onclick="goToFolder('${stack.id}')">View All →</div>` : '';
```

The stack name and header bar gain an `onclick` → `goToFolder(stack.id)` which navigates to
`showshak-stack.html?stack=<id>`. The preview cards stay title-blind (unchanged markup).

### Feed handler (`showshak-feed.html`)

The `ssFeedStackDeepLink` IIFE is reduced to a redirect: if `?stack=<id>` is present,
`location.replace('showshak-stack.html?stack=' + encodeURIComponent(stackId))`. The
clip-opening and collaborative auto-join code is removed (its logic moves to the folder
route). The `?clip=<id>` handler is untouched (Req 13.2).

## Data Models

**No new migration.** The feature consumes the existing `get_shared_stack` RPC payload
(migration 0023) exactly as `ssLoadSharedStackById` already returns it:

```
{
  stack:  { id, name, user_id, visibility, highlighted, mode },
  clips:  [ { id, description, fires_count, views_count, creator{username,...},
              added_by, added_by_username, title{...}, platform{...}, ... }, ... ],
  members:[ { user_id, role, username }, ... ],
  memberCount: <int>,
  viewerIsMember: <bool>
}
```

Mapping to the UI:

| UI element | Source field(s) |
| --- | --- |
| Header name / details | `stack.name`, `clips.length`, `stack.mode` |
| Creator @handle | owner resolved from `stack.user_id` + `members[].username` (role `owner`) |
| Contributor list | `ssStackContributors(owner, members)` |
| Grid card creator | `clip.creator.username` |
| Grid card 🔥 fires | `clip.fires_count` |
| Grid card attribution chip | `clip.added_by_username` (collaborative only) |
| Auto-join gating | `stack.mode`, `memberCount`, `viewerIsMember` |
| Share option gating | role via `ssResolveMyRole` / `ssIsCuratorAccountSync` |

**Gap check (Req 14.3):** the existing payload already carries name, clips (with creator +
fires), members (with username + role), member_count, and viewer_is_member. The title-blind
grid deliberately does **not** use `clip.title`/`clip.platform`. Therefore **no field is
missing and no migration is required.** If a future need for, e.g., a per-stack description
field arises it would be flagged here — but nothing in these requirements needs it.

The local Watchlist render continues to read the `ss_stacks_v1` sessionStorage cache
populated by `ssHydrateStacks()` (with `visibility`, `highlighted`, `mode`, `ownerId`, and
per-clip `addedBy`/`addedByName`); the folder route reads from the RPC so it works for guests
and shared links.

<!-- PBT ASSESSMENT: The three new functions are pure, total, deterministic transforms over
     structured inputs (lists, identities, role/visibility strings) with clear universal
     properties (prefix/length/flag invariants, ordering + de-duplication invariants, role
     gating). PBT IS appropriate for them. The page/route/DOM, the RPC read, the native
     share invocation, and the redirect are I/O / UI and are covered by the manual checklist
     and the unchanged integration paths — not PBT. Proceeding to prework for the 3 pure fns. -->

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system should do.
Properties serve as the bridge between human-readable specifications and machine-verifiable
correctness guarantees.*

Only the three new pure functions carry universal properties. The route, the RPC read, the
native-share invocation, the redirect, and all title-blind *rendering* are UI/integration
concerns covered by the manual checklist, example/snapshot checks, and the already-green
stack-sharing suite (see Testing Strategy). After reflection, the testable criteria
consolidate into the four non-redundant properties below.

### Property 1: Preview "View All" biconditional

*For any* clip list and *any* cap, `ssStackPreviewClips(clips, cap)` returns
`viewAll === true` if and only if `clips.length > cap` (strictly greater); when
`clips.length <= cap` the flag is `false`.

**Validates: Requirements 4.2, 4.3, 10.1, 10.2**

### Property 2: Preview shown is the order-preserving prefix

*For any* clip list and *any* cap, the `shown` array returned by
`ssStackPreviewClips(clips, cap)` equals `clips.slice(0, min(cap, clips.length))` — i.e. it
is a same-order prefix of the input whose length never exceeds the cap, with no clip dropped
from within that prefix and no clip duplicated.

**Validates: Requirements 4.1, 4.4, 10.3, 10.4**

### Property 3: Contributors are owner-first, de-duplicated, order-preserving

*For any* owner and *any* `members[]` list, `ssStackContributors(owner, members)` returns a
list whose first element is the owner, followed by every *other* member in their original
relative order, with each identity appearing at most once (the owner is never duplicated even
when present in `members`). When there is no non-owner member, the result is exactly the
single-element list `[owner]`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.3, 11.4**

### Property 4: Share options are role-gated and independent of current visibility

*For any* role and *any* current visibility, `ssShareVisibilityOptions(role, currentVisibility)`
returns exactly `['private','unlisted','public']` when the role is a curator and exactly
`['private','unlisted']` otherwise — `public` is present if and only if the role is a curator —
and the returned set never changes with `currentVisibility` (it marks the current choice but
never widens the allowed set).

**Validates: Requirements 8.3, 8.4, 12.1, 12.2, 12.3, 12.4**

## Error Handling

| Condition | Behavior | Notes |
| --- | --- | --- |
| **Missing/invalid `?stack=` id** | Folder route renders the "unavailable" state immediately; no RPC call with a bad id. | No leak; clean back button. |
| **Unavailable / private / not-found** | `ssLoadSharedStackById` returns `null` → "this stack isn't available" state, no clips, **no title** (Req 7.3). | Privacy is RLS/RPC-enforced; the route only renders what the RPC chooses to return. |
| **Empty stack (`clips: []`)** | Render an empty state ("no clips yet"), not an error (Req 7.4). | Header still shows name + creator. |
| **Offline / RPC failure** | `ssLoadSharedStackById` resolves `null` (fail-soft, never throws) → "unavailable" state. | Same path as private; no broken screen. |
| **Guest (signed-out)** | Folder view renders via the anon-allowed read path (Req 7.2). Share/collaborate degrade to a sign-in prompt. | Viewing never requires auth. |
| **Collaborative, not eligible/ full** | Auto-join is skipped or surfaces the existing toast ("full" / "sign in"); viewing still works. | Gated by `ssCanJoinStack`; RPC re-checks the cap. |
| **Share of a stack the user chose `private` for** | No link is generated; the chooser simply persists `private` and closes (Req 9.2). | No silent auto-promote (Req 9.1). |
| **`navigator.share` unsupported** | Clipboard fallback copies the title-blind text + link; if that also fails, a toast explains sharing isn't supported. | Mirrors existing `ssShareStack` fallback. |
| **Old `?stack=` link hitting the feed** | `location.replace` to the folder route, preserving the id. | Back button skips the dead hop. |

## Security / Privacy

- **Title-blind everywhere.** Folder grid cards and Watchlist preview cards render only
  creator + 🔥 fires; no show title and no platform badge. Share `title`/`text` contain no
  show title. A title is revealed **only** in the Watch It sheet (Req 2, 3.5, 4.5, 8.5).
- **RLS + `get_shared_stack` is the only boundary.** The new pure functions are UX-only and
  are never trusted for access decisions. The folder route shows exactly what the RPC
  returns; an unavailable stack yields `null` and an "unavailable" state.
- **Unlisted stays non-enumerable.** The route reaches a stack only by its UUID through the
  SECURITY DEFINER RPC; nothing in this feature adds a list/enumeration path. Re-pointing
  the share URL to the new route does not change the read path.
- **Curator-gated `public`.** `ssShareVisibilityOptions` only offers `public` to curators,
  reusing the same role rule as `ssStackShelfPlacement`/`ssIsCuratorAccountSync`, so the UI
  cannot offer a visibility the backend would reject.
- **No new migration, no new grants.** The attack surface is unchanged from stack-sharing.

## Testing Strategy

**Dual approach.** Property-based tests cover the three pure functions; example/snapshot and
manual checks cover rendering, navigation, and the share/shared-link flows; the existing
stack-sharing suite guards against regressions.

### Property-based tests (fast-check)

- Library: **fast-check** (already used across the project, e.g. `tests/prop-pitch.test.js`).
  Do **not** hand-roll generators frameworks.
- Minimum **100 iterations** per property.
- Each test imports the function via `module.exports` (dual-export) and is tagged with a
  comment referencing the design property, format:
  `// Feature: stack-folder-view, Property <n>: <property text>`.
- One property test per correctness property:

  | Test | Property | Generators |
  | --- | --- | --- |
  | `prop-stack-preview-viewall` | Property 1 | arrays of arbitrary length + integer caps (incl. 0, len, len±1, large) |
  | `prop-stack-preview-prefix` | Property 2 | arrays (with unique ids to detect drop/dup) + caps |
  | `prop-stack-contributors` | Property 3 | arbitrary owner + members[] (incl. owner-in-members, duplicate ids, empty) |
  | `prop-share-visibility-options` | Property 4 | role ∈ {curator, user, random strings, null} × visibility ∈ {private, unlisted, public, junk} |

  Edge cases are folded into the generators: empty/non-array `clips`, non-positive/non-number
  `cap` (falls back to `SS_STACK_PREVIEW_CAP`), owner appearing inside `members`, duplicate
  member ids, unknown roles (treated as normal user), and junk `currentVisibility`.

### Example / snapshot tests

- Title-blind card markup: assert the folder grid card and the Watchlist preview card
  contain creator + fires and contain **no** title text and **no** platform-badge element
  (Req 2.1–2.3, 4.5).
- Empty-state render branch when `clips` is empty (Req 7.4).

### Static + suite gates

- `node --check showshak-shared.js` (and any edited `.html` script blocks where feasible)
  after each change (Req 10.5, 11.5, 12.5).
- Full test suite green at every checkpoint — the shipped stack-sharing property suite
  (41 green files) must stay green (Req 13.1–13.4).

### Manual checklist

1. **Route + deep link:** open `showshak-stack.html?stack=<id>` directly; header shows name +
   creator; grid shows all clips; back button returns cleanly (Req 1).
2. **Folder → viewer:** tap a grid clip → viewer opens on that clip with the whole stack as
   the swipe playlist (Req 6).
3. **Watchlist preview:** a >12-clip stack shows 12 cards + a View All tile; a ≤12-clip stack
   shows no tile; name/header/View All all open the folder route (Req 4, 5).
4. **Shared link:** open a `?stack=` link signed-out (guest sees folder), as a stranger to a
   private stack (unavailable, no leak), and as an eligible signed-in user of a collaborative
   stack (auto-joins on the folder route) (Req 7). Confirm an old feed `?stack=` link
   redirects to the folder route.
5. **Share flow:** tap Share → chooser shows role-correct options (curator sees Public);
   pick a visibility → it persists; non-private → native share fires with a `?stack=` link
   and title-blind text; private → no link; sharing a private stack never silently promotes
   it (Req 8, 9). Confirm the ⋮ menu still has the visibility controls.
6. **Regressions:** save-to-stack still works; `?clip=` still opens the viewer; new stacks
   default to private (Req 13, 9.3).

### Phasing

Single phase. The pure functions, the new route, the Watchlist preview change, the feed
redirect, and the share chooser are cohesive and ship together; nothing here requires a
schema change so there is no migration checkpoint to sequence around.
