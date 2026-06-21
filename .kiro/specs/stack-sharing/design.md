# Design Document

## Overview

Stack Sharing adds a visibility model (`private` / `unlisted` / `public`), a shareable
"open this stack" view, and (Phase 2) collaborative multi-contributor stacks — all with
privacy enforced in the database via RLS, not the UI.

The design reuses what already exists:
- **Storage:** the `stacks` + `stack_items` tables and the existing sessionStorage-cache
  + DB-mirror pattern (`_ssDb*` helpers, `ssHydrateStacks`).
- **Viewer:** the universal clip viewer (`ssOpenClip(clip, list)`) — a shared-stack link
  opens the stack's clips in the exact same viewer the `?clip=` deep link already uses.
- **Public profile:** `hydrateCuratorProfile` already loads a curator's public stacks;
  it switches to read the new `visibility` column.

The hard constraint is the **unlisted** case: an unlisted stack must be reachable *only*
by its (unguessable UUID) link and must NOT be enumerable. Plain table RLS that allows
`SELECT` of all non-private rows would let anyone list every unlisted stack — a leak. So
shared reads go through a `SECURITY DEFINER` RPC keyed by stack id; direct table `SELECT`
stays restricted to the owner (and, for listing, public rows only).

## Architecture

```
Owner sets visibility/highlight/mode ──▶ stacks row (visibility, highlighted, mode)
                                          + RLS: SELECT = owner OR visibility='public'

Share link  showshak-feed.html?stack=<uuid>
   │
   ▼
feed deep-link handler ──▶ ssLoadSharedStackById(id)
                              │  (anon key)
                              ▼
                          RPC get_shared_stack(id)  [SECURITY DEFINER]
                              │  returns {stack, clips[]} iff visibility<>'private' OR owner
                              ▼
                          ssOpenClip(clips[0], clips)   ← universal viewer (mini-feed)

Public profile ──▶ list stacks WHERE visibility='public' (direct SELECT, RLS-allowed)
                     • highlighted=true → Highlights shelf
                     • highlighted=false → Shared Stacks folder

[Phase 2] Collaborative
   open collaborative link + signed in ──▶ join_stack(id) → stack_members row (cap-gated)
   member adds clip ──▶ stack_items insert (RLS: inserter ∈ stack_members) + added_by
   remove ──▶ delete stack_items (RLS: owner OR added_by = me)
```

## Data Models

### Phase 1 — additive columns on `stacks`
```sql
alter table stacks add column if not exists visibility text not null default 'private'
  check (visibility in ('private','unlisted','public'));
alter table stacks add column if not exists highlighted boolean not null default false;
alter table stacks add column if not exists mode text not null default 'view'
  check (mode in ('view','collaborative'));   -- meaningful in Phase 2; additive now
```
Existing rows default to `private` / not-highlighted / `view` → zero behavior change
(Requirement 9).

### Phase 2 — collaboration
```sql
create table if not exists stack_members (
  stack_id  uuid not null references stacks(id) on delete cascade,
  user_id   uuid not null references users(id),
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (stack_id, user_id)
);
alter table stack_items add column if not exists added_by uuid references users(id);
```

### RLS

**Phase 1 — `stacks` SELECT** (no enumeration of unlisted):
```sql
-- owners see their own; everyone may see PUBLIC (listed anyway). Unlisted is NOT
-- directly selectable — it is reached only via get_shared_stack(id).
create policy stacks_read on stacks for select
  using (user_id = auth.uid() or visibility = 'public');
```

**Phase 1 — owner can update visibility/highlight** (already may have an owner-update
policy; ensure it covers these columns):
```sql
create policy stacks_owner_update on stacks for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Phase 1 — `get_shared_stack(p_stack_id uuid)`** — the only read path for unlisted; runs
SECURITY DEFINER so it can read past the table policy, but returns rows ONLY when the
stack is shareable or owned:
```sql
create or replace function public.get_shared_stack(p_stack_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s stacks; items jsonb;
begin
  select * into s from stacks where id = p_stack_id and deleted_at is null;
  if not found then return null; end if;
  if s.visibility = 'private' and s.user_id <> auth.uid() then return null; end if;
  select jsonb_agg(to_jsonb(c) order by si.created_at)
    into items
    from stack_items si join content c on c.id = si.content_id
   where si.stack_id = p_stack_id and c.status = 'live' and c.deleted_at is null;
  return jsonb_build_object('stack', to_jsonb(s), 'clips', coalesce(items, '[]'::jsonb));
end; $$;
grant execute on function public.get_shared_stack(uuid) to anon, authenticated;
```

**Phase 2 — collaborative write** on `stack_items`:
```sql
-- INSERT allowed when the stack is collaborative AND inserter is a member, or owner.
create policy stack_items_collab_insert on stack_items for insert
  with check (
    exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
    or exists (select 1 from stacks s join stack_members m on m.stack_id = s.id
               where s.id = stack_id and s.mode = 'collaborative' and m.user_id = auth.uid())
  );
-- DELETE allowed for the owner or the contributor who added the item.
create policy stack_items_collab_delete on stack_items for delete
  using (
    exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
    or added_by = auth.uid()
  );
```

**Phase 2 — member cap** via a BEFORE INSERT trigger on `stack_members` that rejects when
the current count ≥ `SS_STACK_MEMBER_CAP` (a constant mirrored as a SQL setting/literal,
default 6).

## Components and Interfaces

### Pure functions (showshak-shared.js — DOM-free, dual-exported, property-tested)
```js
ssStackCanView(viewerId, stack)        // owner || visibility !== 'private'
ssStackIsListed(stack)                 // visibility === 'public'
ssStackShelfPlacement(stack)           // 'highlights' | 'folder' | 'none'
ssCanContribute(viewerId, stack, memberIds)          // collaborative && member
ssCanJoinStack(stack, memberCount, cap, alreadyMember) // collaborative && room && !member
ssCanRemoveStackItem(viewerId, item, stack)          // owner || item.added_by === viewer
```
`SS_STACK_MEMBER_CAP = 6` lives next to these (single source for the limit).

### Impure helpers (showshak-shared.js)
- `ssLoadSharedStackById(id)` → calls `get_shared_stack` RPC, maps clips via the existing
  `ssMapContentRowsToClips`/`ssClipsForFeed`, returns `{ stack, clips }` or null.
- `ssStackShareUrl(stack)` → `…/showshak-feed.html?stack=<id>` (only for non-private).
- `ssSetStackVisibility(stackId, visibility, highlighted)` → owner UPDATE (mirrors the
  existing `_ssDb*` fire-and-forget pattern).
- Phase 2: `ssJoinStack(id)`, `ssAddClipToSharedStack(id, clipId)`, `ssLeaveStack(id)`.

### UI
- **Watchlist / stack options:** a visibility control (Private / Unlisted / Public*) and,
  for shared stacks, a View/Collaborative toggle; a real Share button using
  `ssStackShareUrl`. (*Public shown only for curators.)
- **Profile shelf:** reads public stacks via the new column; highlighted → Highlights,
  else → folder; zero public → block hidden (already implemented).
- **Feed:** `?stack=<id>` handler (sibling to the `?clip=` handler) → `ssLoadSharedStackById`
  → `ssOpenClip(clips[0], clips)`; unavailable/empty states per Req 4.

## Correctness Properties

### Property 1: View access
`ssStackCanView` is true for the owner regardless of visibility, and for any viewer when
visibility ≠ 'private'; false only for a non-owner on a private stack.
**Validates: Requirements 2.1, 2.2, 4.2**

### Property 2: Listed only when public
`ssStackIsListed` is true iff visibility === 'public'.
**Validates: Requirements 2.3, 3.4**

### Property 3: Shelf placement
`ssStackShelfPlacement` returns 'highlights' iff public+highlighted, 'folder' iff
public+not-highlighted, 'none' otherwise — never places a non-public stack.
**Validates: Requirements 3.2, 3.3**

### Property 4: Join respects the cap
`ssCanJoinStack` is true iff collaborative AND memberCount < cap AND not already a member;
it never permits membership to exceed the cap.
**Validates: Requirements 6.2, 6.3, 6.4**

### Property 5: Removal authority
`ssCanRemoveStackItem` is true iff the viewer is the owner OR the original contributor — a
non-owner can never remove another member's item.
**Validates: Requirements 8.1, 8.2**

### Property 6: Contribution authority
`ssCanContribute` is true iff the stack is collaborative AND the viewer is a member (owner
included).
**Validates: Requirements 7.1**

## Security / Privacy

- Unlisted stacks are non-enumerable: direct `SELECT` is owner-or-public only; unlisted is
  reachable solely through `get_shared_stack(id)` (requires the UUID).
- All access decisions are RLS/RPC-enforced; the pure JS functions are for UI/UX only and
  are never the security boundary.
- No share path includes a show title (title-hidden rule).
- Unlisted = "anyone with the link"; the owner is told this when choosing it.

## Error Handling

- **Unavailable / private stack:** `get_shared_stack` returns null → the feed shows an
  "this stack isn’t available" state; no clips, no leak (Req 4.2).
- **Empty stack:** RPC returns `clips: []` → the viewer shows an empty state, not an error.
- **RPC / network failure on share-open:** fail soft to an "unavailable" state and keep the
  feed usable behind it (never a blank/broken screen).
- **Share of a private stack:** blocked client-side with a prompt to make it
  unlisted/public first (Req 5.3); the link is never generated for private.
- **Join when full (Phase 2):** the cap trigger rejects the insert → "this stack is full"
  message; no partial membership.
- **Unauthorized write (Phase 2):** RLS denies the insert/delete → surfaced as a soft toast;
  the UI never assumes success before the DB confirms.
- **Offline / guest:** shared-stack viewing works for guests (read path is anon-allowed);
  contributing requires sign-in and degrades to a sign-in prompt.

## Phasing

- **Phase 1 (shippable alone):** columns + `stacks_read` RLS + `get_shared_stack` RPC +
  `ssLoadSharedStackById` + `ssStackShareUrl` + `ssSetStackVisibility` + the pure view
  functions + feed `?stack=` handler + Watchlist visibility/share UI + profile listing.
- **Phase 2:** `stack_members` + `added_by` + collaborative RLS + cap trigger + join flow +
  contribute/remove UI + attribution.

## Testing Strategy

- Property tests (fast-check) for the six pure functions above — every viewer/visibility/
  membership combination, asserting no privacy leak and no cap violation.
- `node --check` + full suite green at each checkpoint (35+ files).
- Manual: open an unlisted link signed-out (works), a private link as a stranger (blocked),
  a public stack on a profile (listed), and confirm a direct `select * from stacks` as anon
  returns only public rows (no unlisted enumeration).
- Migrations are founder-applied in the SQL editor (per the project's manual-migration flow).
