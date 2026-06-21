# Requirements Document

## Introduction

Stacks (named collections of saved clips) are currently owner-only and persist via a
sessionStorage cache mirrored to the DB (`stacks` + `stack_items`). There is no way to
share a stack, no visibility model, and the existing "share" buttons are dead links /
fake toasts.

This feature turns Stacks into a sharable, optionally collaborative surface — the
"watch this together" layer of ShowShak — while strictly preserving privacy in the
database (RLS), never just in the UI.

The model is the familiar **private / unlisted / public** scheme (like YouTube), plus a
**view vs collaborative** mode for shared stacks:

- **Private** — owner only. The default.
- **Unlisted** — viewable by anyone with the link; not listed anywhere. The "share with
  friends & family over WhatsApp" case.
- **Public** (curators only) — viewable by anyone AND listed on the curator's public
  profile, either in the **Highlights** shelf (their best) or the **Shared Stacks**
  folder next to Clips. A `highlighted` flag chooses which.

A shared stack (unlisted or public) can be **view** (non-owners watch the clips) or
**collaborative** (invited members can also ADD clips, capped at a configurable maximum
— default 6 members including the owner).

**Roles:** Curators get private/unlisted/public; normal users get private/unlisted only
(no public listing — users have no public profile surface).

**Phasing (build order; the data model is designed for all of it up front):**
- *Phase 1 — Visibility + Viewing:* visibility field + persistence, RLS for
  read-by-link vs profile-listing, the shared-stack view (open + watch via link), share
  links, and the make-private/unlisted/public + highlight controls. Read-only for
  non-owners.
- *Phase 2 — Collaboration:* collaborator membership, join-via-link, write RLS, the
  member cap, per-clip attribution, and removal rules.

**Sacred-rule alignment:** privacy is enforced by RLS (never UI-only); a shared/clip
link never reveals a show title (titles hidden until Watch It); unlisted means "anyone
with the unguessable UUID link," not an approved-people list (the standard unlisted
tradeoff, surfaced explicitly to the owner).

**Correctness properties (to be property-tested as pure functions):**
`ssStackCanView(viewerId, stack)`, `ssStackIsListed(stack)`,
`ssStackShelfPlacement(stack)`, `ssCanContribute(viewerId, stack, memberIds)`,
`ssCanJoinStack(stack, memberCount, cap, alreadyMember)`,
`ssCanRemoveStackItem(viewerId, item, stack)`.

## Glossary

- **Stack** — a named collection of saved clips owned by a user.
- **Visibility** — one of `private`, `unlisted`, `public` (per stack).
- **Unlisted** — viewable by anyone holding the link (UUID); not listed anywhere.
- **Public** — viewable by anyone and listed on the owner's public profile (curators only).
- **Highlighted** — a flag on a public stack selecting the Highlights shelf vs the
  Shared Stacks folder.
- **Mode** — a shared stack is `view` (read-only for non-owners) or `collaborative`.
- **Member / collaborator** — a signed-in user permitted to add clips to a collaborative
  stack; the owner is always a member.
- **Member cap** — the configurable maximum members per stack (default 6, incl. owner).

## Requirements

### Requirement 1: Stack visibility model

**User Story:** As a stack owner, I want to set whether a stack is private, unlisted, or
public, so that I control who can see it.

#### Acceptance Criteria
1. THE system SHALL persist a `visibility` value of `private`, `unlisted`, or `public`
   on each stack in the database.
2. WHEN a stack is created, THE system SHALL default its visibility to `private`.
3. WHERE the owner is a normal user (not a curator), THE system SHALL allow only
   `private` and `unlisted` visibility.
4. WHERE the owner is a curator, THE system SHALL allow `private`, `unlisted`, and
   `public` visibility.
5. WHEN the owner changes a stack's visibility, THE system SHALL persist the change and
   reflect it on the next read.

### Requirement 2: Read access enforced by RLS

**User Story:** As a user opening a shared link, I want to see the stack only if I'm
allowed to, so that private stacks never leak.

#### Acceptance Criteria
1. THE database SHALL allow reading a stack and its items by id WHEN the stack
   visibility is `unlisted` OR `public`, OR the requester is the owner.
2. IF a stack is `private` AND the requester is not the owner, THEN THE database SHALL
   return no rows.
3. THE database SHALL allow listing a user's stacks on their public profile ONLY for
   stacks whose visibility is `public`.
4. THE read policy SHALL be enforced by RLS, independent of any UI filtering.

### Requirement 3: Profile listing and highlight placement (curators)

**User Story:** As a curator, I want to feature my best public stacks in Highlights and
keep the rest in a folder, so visitors see my best first without hiding the rest.

#### Acceptance Criteria
1. THE system SHALL persist a `highlighted` boolean on stacks (meaningful only when
   visibility = `public`).
2. WHERE a public stack is `highlighted`, THE public profile SHALL render it in the
   Highlights shelf.
3. WHERE a public stack is NOT `highlighted`, THE public profile SHALL render it in the
   Shared Stacks folder, not the Highlights shelf.
4. IF a curator has zero public stacks, THEN THE public profile SHALL hide the shelf
   block entirely.

### Requirement 4: Shared-stack view (open and watch via link)

**User Story:** As someone with a shared link, I want it to open that stack's clips and
let me watch them, so the link does what it promises.

#### Acceptance Criteria
1. WHEN a shared-stack link (`?stack=<id>`) is opened, THE system SHALL load that
   stack's clips and present them in the clip viewer.
2. IF the stack is not viewable by the requester, THEN THE system SHALL show an
   "unavailable" state and SHALL NOT reveal any clips.
3. THE shared-stack view SHALL NOT display a clip's show title before Watch It.
4. WHEN the stack has no clips, THE system SHALL show an empty state rather than an error.

### Requirement 5: Sharing a stack (link generation)

**User Story:** As a stack owner, I want a real share link for an unlisted or public
stack, so I can send it via WhatsApp etc.

#### Acceptance Criteria
1. WHERE a stack is `unlisted` or `public`, THE share action SHALL produce a link of the
   form `<app>/showshak-feed.html?stack=<uuid>` (or equivalent route).
2. THE share text SHALL NOT include any show title.
3. IF a stack is `private`, THEN THE share action SHALL prompt the owner to make it
   unlisted/public first.
4. THE share SHALL use the native share sheet when available and copy-to-clipboard
   otherwise.

### Requirement 6: Collaborative stacks — membership (Phase 2)

**User Story:** As a stack owner, I want friends to join a collaborative stack via its
link, so we can build a watchlist together.

#### Acceptance Criteria
1. THE system SHALL persist a per-stack `mode` of `view` or `collaborative`.
2. WHEN a signed-in user opens a `collaborative` stack link AND is not already a member
   AND the stack is below the member cap, THE system SHALL add them as a member.
3. THE system SHALL enforce a configurable maximum members per stack (default 6,
   including the owner).
4. IF the member cap is reached, THEN THE system SHALL deny further joins and show a
   "this stack is full" message.
5. IF a user opening a collaborative link is NOT signed in, THEN THE system SHALL prompt
   sign-in before joining.
6. THE owner SHALL always be a member and SHALL NOT be removable.

### Requirement 7: Collaborative stacks — contributing and attribution (Phase 2)

**User Story:** As a member of a collaborative stack, I want to add clips that everyone
sees, with my additions attributed.

#### Acceptance Criteria
1. THE database SHALL allow inserting a `stack_items` row for a collaborative stack ONLY
   when the inserter is a member of that stack (RLS-enforced).
2. THE system SHALL record `added_by` on each stack item.
3. WHEN a member adds a clip, THE stack SHALL show that clip to all members on their
   next load.
4. THE system SHALL de-duplicate: the same clip SHALL NOT appear twice in one stack.

### Requirement 8: Collaborative stacks — removal rules (Phase 2)

**User Story:** As a member, I want to remove clips I added; as the owner, I want to
remove anything and manage members.

#### Acceptance Criteria
1. THE database SHALL allow deleting a `stack_items` row WHEN the requester is the owner
   OR `added_by` equals the requester (RLS-enforced).
2. IF a non-owner member attempts to remove a clip they did not add, THEN THE database
   SHALL deny the delete.
3. THE owner SHALL be able to remove any member from the stack.
4. WHEN a member is removed, THE system SHALL keep the clips they already added unless
   the owner explicitly removes those clips.

### Requirement 9: No regressions to existing Stacks

**User Story:** As an existing user, I want my current Stacks and the Watchlist to keep
working unchanged.

#### Acceptance Criteria
1. THE existing private Stacks behavior (save, rename, delete, view in Watchlist) SHALL
   continue to work unchanged for `private` stacks.
2. THE new visibility/mode columns SHALL be additive (existing rows default to
   `private` / `view`) so no existing stack changes behavior on migration.
3. THE full property-test suite SHALL remain green at every phase checkpoint.
