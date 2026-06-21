# Requirements Document

## Introduction

ShowShak is a trust-based, creator-curated streaming DISCOVERY layer. The shipped
**stack-sharing** feature (`.kiro/specs/stack-sharing/`) turned Stacks into sharable,
optionally collaborative collections with a `private` / `unlisted` / `public` visibility
model, a `view` / `collaborative` mode, and a database-enforced read path
(`get_shared_stack(id)` SECURITY DEFINER RPC, surfaced by `ssLoadSharedStackById(id)` as
`{ stack, clips, members, memberCount, viewerIsMember }`).

This feature, **Stack Folder View**, adds the missing "browse the whole stack" surface and
changes how stacks are entered:

- A dedicated **Stack Folder View** (a real route, e.g. `showshak-stack.html?stack=<id>`,
  so deep-links and the browser back button behave cleanly) that shows the stack name and
  details, the curator/owner who made it (plus contributors for collaborative stacks), and
  ALL the stack's clips in a title-blind GRID.
- A **Watchlist change**: each stack row shows a capped preview (~10–12 clips) in the
  existing horizontal scroll, then a "View All" tile that opens the Folder View. The stack
  name and header bar also open the Folder View.
- **Open-a-clip from the folder**: tapping any grid clip opens the full-screen clip viewer
  (`ssOpenClip`) with the WHOLE stack as the swipe playlist.
- **Shared-link behavior change**: a `?stack=<id>` link currently opens the first clip
  directly (autoplay mini-feed). It will instead open the Folder View, from which the
  recipient taps into a clip. Unavailable / empty / private states are preserved and never
  leak a title; viewing works for guests; collaborative auto-join still applies.
- **Share flow**: tapping Share on a stack first shows a visibility chooser (set privacy),
  then hands off to the native OS share sheet with the `?stack=` link and title-blind text.
  These visibility controls also remain in the stack's ⋮ menu. This explicit chooser
  supersedes (and must reconcile) an uncommitted interim change in `ssShareStack` that
  auto-promoted `private` → `unlisted` on share.

**Sacred rules preserved (firm constraints):**
- **Title-blind:** clip cards (including the Folder grid and the Watchlist preview) NEVER
  show the show title or a platform badge; the title is revealed ONLY in the Watch It
  sheet. Cards lead with creator + 🔥 fires.
- **Fire = the like; Watch It is the climax; the scoreboard is hidden** (no fires-received
  totals / watch-it taps shown publicly — RLS-enforced).
- **Curator identity is NOT hidden** — the stack creator's @handle and contributor handles
  are shown; only show titles are hidden.

**Reuse, no new migration expected:** this feature consumes the existing
`get_shared_stack` RPC fields (`stack {id,name,user_id,visibility,highlighted,mode}`,
`clips[]` each with `added_by` + `added_by_username` + `creator`/`title`/`platform`,
`members[]` `{user_id, role, username}`, `member_count`, `viewer_is_member`) and the
existing pure rules (`ssStackShelfPlacement`, role helpers, `ssStackCanView`). No new
migration is anticipated; any genuine gap is flagged in Requirement 11.

**Correctness properties (pure, DOM-free, dual-exported, fast-check):**
`ssStackPreviewClips(clips, cap)` (Watchlist preview truncation + "View All" flag),
`ssStackContributors(owner, members)` (ordered, de-duplicated attribution list),
`ssShareVisibilityOptions(role, currentVisibility)` (allowed visibility choices by role).

## Glossary

- **Stack** — a named collection of saved clips owned by a user.
- **Stack Folder View** — a dedicated route/view rendering a stack's name, details,
  creator/contributors, and ALL its clips in a grid.
- **Folder grid** — the title-blind grid of clip cards in the Stack Folder View.
- **Watchlist preview** — the existing horizontal-scroll row on the Watchlist page showing
  a capped number of a stack's clips.
- **View All tile** — a tile appended to a Watchlist preview that opens the Stack Folder
  View; shown only when the stack has more clips than the preview cap.
- **Preview cap** — the maximum number of clips shown in a Watchlist preview before the
  View All tile (target 10–12).
- **Curator** — a creator account permitted `public` visibility; a normal user is permitted
  only `private` / `unlisted`.
- **Owner** — the user who created the stack (`stack.user_id`).
- **Contributor / member** — a signed-in user in a collaborative stack's `members[]`.
- **Contributor list** — the ordered, de-duplicated attribution list (owner first, then
  other members) shown in the Folder View header.
- **Clip viewer** — the existing full-screen viewer opened by `ssOpenClip(clip, list)`.
- **Watch It sheet** — the only surface where a clip's show title is revealed.
- **Shared link** — a `?stack=<id>` URL that opens a stack for a recipient.
- **`ssLoadSharedStackById(id)`** — the impure read path returning
  `{ stack, clips, members, memberCount, viewerIsMember }` (or null when unavailable).

## Requirements

### Requirement 1: Stack Folder View route and structure

**User Story:** As a viewer, I want a dedicated page that shows a stack's name, who made
it, and all its clips, so that I can browse the whole collection and deep-link to it.

#### Acceptance Criteria
1. THE Stack Folder View SHALL be reachable as a route that carries the stack id as a
   parameter (for example `showshak-stack.html?stack=<id>`), so that the view is
   deep-linkable.
2. WHEN the Stack Folder View is opened with a stack id, THE System SHALL load that stack
   through `ssLoadSharedStackById(id)`.
3. WHEN a stack is loaded, THE Stack Folder View SHALL display the stack name and stack
   details at the top of the view.
4. WHEN a stack is loaded, THE Stack Folder View SHALL display all clips returned for that
   stack in a grid below the header.
5. WHEN the browser back action is invoked from the Stack Folder View, THE System SHALL
   return to the previously displayed view.

### Requirement 2: Title-blind Folder grid cards

**User Story:** As a viewer, I want the folder grid to lead with the creator and fires and
never spoil the show title, so that the title-blind discovery experience is preserved.

#### Acceptance Criteria
1. THE Folder grid SHALL render each clip card with the clip creator and the clip's 🔥
   fires count.
2. THE Folder grid SHALL NOT display a clip's show title on any card.
3. THE Folder grid SHALL NOT display a platform badge on any card.
4. THE Stack Folder View SHALL reveal a clip's show title ONLY in the Watch It sheet.

### Requirement 3: Folder header creator and contributor attribution

**User Story:** As a viewer, I want to see who made the stack and, for collaborative
stacks, who contributed, so that I trust the source and see attribution.

#### Acceptance Criteria
1. THE Stack Folder View header SHALL display the stack owner's @handle as the creator.
2. WHERE a stack's mode is `collaborative`, THE Folder header SHALL display the contributor
   list with the owner first, followed by the other members.
3. THE Folder header SHALL list each contributor at most once (de-duplicated).
4. WHERE a stack's mode is `view`, THE Folder header SHALL display only the creator and
   SHALL NOT display a contributor list.
5. THE Folder header SHALL display contributor @handles and SHALL NOT display any show
   title.

### Requirement 4: Watchlist preview truncation and View All tile

**User Story:** As a user on my Watchlist, I want each stack row to show a manageable
preview with a way to see everything, so that long stacks stay scannable.

#### Acceptance Criteria
1. THE Watchlist preview SHALL display at most the preview-cap number of clips in the
   existing horizontal scroll for each stack.
2. IF a stack has more clips than the preview cap, THEN THE Watchlist preview SHALL append
   a View All tile at the end of the preview.
3. IF a stack has at most the preview-cap number of clips, THEN THE Watchlist preview SHALL
   NOT append a View All tile.
4. THE Watchlist preview SHALL preserve the order of clips and SHALL NOT drop or duplicate
   any clip within the shown subset.
5. THE Watchlist preview cards SHALL remain title-blind, displaying creator and 🔥 fires
   only.

### Requirement 5: Entering the Folder View from the Watchlist

**User Story:** As a user, I want tapping View All, the stack name, or the stack header to
open the full stack, so that I can browse everything in one place.

#### Acceptance Criteria
1. WHEN a user taps the View All tile of a stack, THE System SHALL open the Stack Folder
   View for that stack.
2. WHEN a user taps a stack's name, THE System SHALL open the Stack Folder View for that
   stack.
3. WHEN a user taps a stack's header bar, THE System SHALL open the Stack Folder View for
   that stack.

### Requirement 6: Open a clip from the Folder grid

**User Story:** As a viewer, I want tapping a clip in the folder to open the full-screen
viewer with the rest of the stack ready to swipe, so that I can keep watching.

#### Acceptance Criteria
1. WHEN a user taps a clip in the Folder grid, THE System SHALL open the clip viewer via
   `ssOpenClip` for the tapped clip.
2. WHEN the clip viewer is opened from the Folder grid, THE System SHALL pass the whole
   stack's clips as the swipe playlist.
3. WHEN the clip viewer is opened from the Folder grid, THE System SHALL begin at the
   tapped clip's position within that playlist.

### Requirement 7: Shared-link opens the Folder View

**User Story:** As a recipient of a shared link, I want it to open the stack's folder so I
can choose what to watch, instead of being dropped into the first clip.

#### Acceptance Criteria
1. WHEN a `?stack=<id>` shared link is opened, THE System SHALL display the Stack Folder
   View for that stack rather than opening the first clip directly.
2. WHEN a shared link is opened by a guest (signed-out user), THE System SHALL display the
   Stack Folder View using the anonymous-allowed read path.
3. IF the stack is not viewable by the requester, THEN THE System SHALL show an
   "unavailable" state and SHALL NOT reveal any clips or show title.
4. WHEN the stack has no clips, THE System SHALL show an empty state rather than an error.
5. WHERE a stack's mode is `collaborative` and the requester is eligible to join, THE
   System SHALL apply the existing stack-sharing auto-join behavior when the link is
   opened.

### Requirement 8: Share flow visibility chooser then native share

**User Story:** As a stack owner, I want to choose the stack's privacy and then share it
through my phone's share sheet, so that I control visibility before sending the link.

#### Acceptance Criteria
1. WHEN a user taps Share on a stack, THE System SHALL first present a visibility chooser
   before invoking the native share sheet.
2. WHEN the user selects a visibility in the chooser, THE System SHALL persist that
   visibility on the stack.
3. WHERE the user is a normal user (not a curator), THE visibility chooser SHALL offer
   `private` and `unlisted` only.
4. WHERE the user is a curator, THE visibility chooser SHALL offer `private`, `unlisted`,
   and `public`.
5. WHEN the user confirms a non-private visibility in the chooser, THE System SHALL invoke
   the native share sheet (`navigator.share`) with the `?stack=<id>` link and share text
   that contains no show title.
6. THE visibility controls offered in the share chooser SHALL also remain available in the
   stack's ⋮ menu.

### Requirement 9: Reconcile the interim auto-promote share behavior

**User Story:** As a maintainer, I want the new explicit visibility chooser to replace the
uncommitted auto-promote-on-share behavior, so that sharing never changes privacy without
the owner's choice.

#### Acceptance Criteria
1. THE System SHALL NOT automatically change a stack's visibility from `private` to
   `unlisted` as a side effect of tapping Share.
2. WHEN a private stack is shared, THE System SHALL require an explicit visibility selection
   through the chooser before producing a share link.
3. THE default visibility at stack creation SHALL remain `private`.

### Requirement 10: Watchlist preview clip selection (pure logic)

**User Story:** As a developer, I want the preview truncation computed by a pure function,
so that the cap and View All behavior are deterministic and property-testable.

#### Acceptance Criteria
1. THE `ssStackPreviewClips` function SHALL accept a clip list and a cap and return the
   shown clips together with a flag indicating whether a View All tile is shown.
2. THE `ssStackPreviewClips` function SHALL return a View All flag of true IF AND ONLY IF
   the input clip count exceeds the cap.
3. THE `ssStackPreviewClips` function SHALL return a shown-clips list whose length does not
   exceed the cap.
4. THE `ssStackPreviewClips` function SHALL return shown clips that are a prefix of the
   input list in the same order, with no dropped or duplicated clip within that prefix.
5. THE `ssStackPreviewClips` function SHALL be DOM-free and dual-exported for Node and
   fast-check.

### Requirement 11: Contributor list assembly (pure logic)

**User Story:** As a developer, I want the header attribution computed by a pure function,
so that owner-first, de-duplicated ordering is deterministic and property-testable.

#### Acceptance Criteria
1. THE `ssStackContributors` function SHALL accept the owner and the `members[]` list and
   return an ordered attribution list with the owner first, followed by the other members.
2. THE `ssStackContributors` function SHALL include each user at most once, even when the
   owner also appears in `members[]`.
3. WHERE the stack is view-only (no members other than the owner), THE `ssStackContributors`
   function SHALL return a list containing only the creator.
4. THE `ssStackContributors` function SHALL preserve the relative order of the non-owner
   members as given.
5. THE `ssStackContributors` function SHALL be DOM-free and dual-exported for Node and
   fast-check.

### Requirement 12: Share visibility-option resolution (pure logic)

**User Story:** As a developer, I want the allowed visibility choices computed by a pure
function, so that role-based options are deterministic and property-testable.

#### Acceptance Criteria
1. THE `ssShareVisibilityOptions` function SHALL accept the user's role and the current
   visibility and return the allowed visibility choices.
2. WHERE the role is a normal user, THE `ssShareVisibilityOptions` function SHALL return
   `private` and `unlisted` and SHALL NOT include `public`.
3. WHERE the role is a curator, THE `ssShareVisibilityOptions` function SHALL return
   `private`, `unlisted`, and `public`.
4. THE `ssShareVisibilityOptions` function SHALL reuse the existing role rules used by
   `ssStackShelfPlacement` and the stack-sharing role helpers.
5. THE `ssShareVisibilityOptions` function SHALL be DOM-free and dual-exported for Node and
   fast-check.

### Requirement 13: No regressions

**User Story:** As an existing user, I want my current Watchlist, deep links, and the
shipped property suite to keep working, so that this feature is additive.

#### Acceptance Criteria
1. THE existing Watchlist save flow (saving a clip to a stack) SHALL continue to work
   unchanged.
2. THE shipped `?clip=<id>` deep link SHALL continue to open the clip viewer unchanged.
3. THE stack-sharing property suite (currently 41 green test files) SHALL remain green at
   every checkpoint.
4. THE new pure functions SHALL be additive and SHALL NOT alter the behavior of the
   existing stack-sharing pure functions.

### Requirement 14: Schema reuse and gap flagging

**User Story:** As a maintainer, I want this feature to reuse the existing shared-stack read
path, so that no new migration is introduced unless genuinely required.

#### Acceptance Criteria
1. THE Stack Folder View SHALL source stack, clip, member, member-count, and
   viewer-membership data from the existing `get_shared_stack` RPC via
   `ssLoadSharedStackById`.
2. THE feature SHALL NOT introduce a new database migration WHERE the existing
   `get_shared_stack` fields and stack-sharing columns are sufficient.
3. IF a required field is genuinely missing from the existing read path, THEN the design
   SHALL flag the gap explicitly rather than silently adding a migration.
