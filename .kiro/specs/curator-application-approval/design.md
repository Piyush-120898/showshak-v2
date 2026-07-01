# Design Document

## Overview

**Curator application & approval** interposes a human review step between "a user wants to
curate" and "a user *is* a curator." Today two paths silently grant curator status with zero
review: completing the "Become a Curator" modal calls `bcActivate()` → `ssBuildOnboardingPatch()`
and writes `users.role = 'curator'` directly, and publishing any clip fires the migration `0020`
trigger `promote_curator_on_post()` which promotes the author on insert. This feature **removes both
self-serve promotions** and replaces them with an application → pending → admin-decision flow.

The design reuses — never reinvents — the machinery established by migration `0029`
(`dmca-moderation-scaffolding`): the security boundary is the **database**, privileged writes go
through **`SECURITY DEFINER` RPCs with a locked `search_path = public`**, RLS denies the underlying
tables to ordinary callers, an **append-only audit table** (modeled on `moderation_log`) records
every privileged action, and the **pure decision logic** lives in `showshak-shared.js` as DOM-free,
dual-exported, `fast-check`-tested helpers that are UI/UX only and are re-validated server-side.

Three guarantees are the spine of this feature and are called out throughout:

1. **The security spine.** A `role` flip to `curator` and a `verified` flip to `true` can NEVER be
   performed client-side by a normal user. Approve / reject / verify run only through admin-only
   `SECURITY DEFINER` RPCs gated by `ss_is_admin()`; RLS blocks direct writes to `users.role` /
   `users.verified` and direct reads of `curator_application` / the audit log.
2. **The review-only-clip guarantee.** An application's optional reference clip is REVIEW-ONLY. It
   is stored in a **private Storage bucket** — never a `content` row, never a public Mux playback
   id — readable only by an admin, and is never published to the feed at any status.
3. **Grandfathering.** Every account already `role = 'curator'` when this ships is treated as an
   already-approved curator: it never applies, never re-prompts, and keeps publishing.

### Admin bootstrap (founder-confirmed, firm)

Admin is granted by a **one-time SQL line the founder runs** on their own account:

```sql
update public.users set is_admin = true where username = '<founder-handle>';
```

There is deliberately **no admin-granting UI** — the smallest possible attack surface for beta.
This feature **refines `ss_is_admin()`** (introduced in `0029` as a `service_role` check) to also
recognize this per-user `is_admin` flag, so the founder's *browser session* (an ordinary
`authenticated` JWT) is admin without holding the service-role key.

### How it fits the existing architecture

- **`users.role` / `users.verified`** already exist; a new **`users.is_admin boolean`** column is
  added (additive). The "VERIFIED CURATOR" pill already renders in `showshak-profile.html`; the
  badge system reuses that surface rather than restyling it.
- **`ssResolveMyRole()`** already resolves the persisted role and drives the profile's user/owner/
  public faces. The application flow slots in where `bcActivate()` used to flip role.
- **Migrations** are founder-applied by hand. Current max applied is `0033`; `0030` is RESERVED for
  DMCA Phase 2. This feature's migrations therefore begin at **`0034`** and split by phase.
- **Pure helpers** join the consolidated `module.exports` block so `node tests/run-all.js` can
  `fast-check` them, exactly like `ssDmcaNoticeWellFormed`, `ssComplaintTransition`, `ssStackCanView`.

### Sacred-rule alignment

Curator status becomes a **vetted trust signal, not a self-serve toggle** (curators-not-influencers).
Badges are trust signals resolved from `{ role, verified }` — never counts — preserving
hide-the-scoreboard. Every privacy boundary (who may read applications, the audit log, the reference
clip) is an **RLS / Storage-policy guarantee, not a UI check**.

## Architecture

```
   PHASE 1 — APPLY (no role flip)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ showshak-profile.html  "Become a Curator" (4-step form; replaces bcActivate)│
 │   step1 info · step2 curator info+genres · step3 social_link (+opt clip) ·  │
 │   step4 accept Curator_Terms                                                │
 │        │ ssValidateCuratorApplication(payload) → {ok,missing}  (client gate)│
 │        │ (opt) upload Reference_Clip → PRIVATE bucket  review-clips/         │
 │        ▼                                                                     │
 │   RPC ss_submit_curator_application(payload)  [SECURITY DEFINER]            │
 │        │ re-validates in SQL · inserts ONE curator_application row           │
 │        │ status='pending' · applicant_id=auth.uid() · terms_version         │
 │        │ role UNCHANGED (Req 1.5/5.3)                                        │
 │        ▼                                                                     │
 │   curator_application (owner may read own; admins read all)                 │
 │        │                                                                     │
 │   Profile status panel ← most-recent Application_Row status (Req 6)         │
 └──────────────────────────────────────────────────────────────────────────┘
   PHASE 2 — DECIDE (privileged flip + audit)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ showshak-admin.html  (NEW page; gated to is_admin)                          │
 │   New/Pending list · Rejected record · Curators list (Make-Verified)        │
 │        │ Approve / Reject / Make-Verified                                    │
 │        ▼                                                                     │
 │   ss_approve_application(app_id)  ┐                                          │
 │   ss_reject_application(app_id)   ├ [SECURITY DEFINER · ss_is_admin() gate]  │
 │   ss_set_curator_verified(uid,v)  ┘                                          │
 │        │ 1) authorize: ss_is_admin() else no-op                             │
 │        │ 2) precondition: status='pending' (approve/reject) else no-op       │
 │        │ 3) mutate (role/status/verified) + append ONE audit row — one txn   │
 │        ▼                                                                     │
 │   curator_application_log (APPEND-ONLY: BEFORE UPDATE/DELETE reject trigger) │
 └──────────────────────────────────────────────────────────────────────────┘
   PHASE 3 — BADGES · GRANDFATHER · PUBLISH GATE
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ ssResolveBadge({role,verified}) → none|curator|verified                     │
 │   rendered on profile · feed · clip cards (Discover/Watchlist/profile)      │
 │ Grandfather: role='curator' already → approved, no application, no prompt   │
 │ Publish_Gate: content INSERT policy requires users.role='curator'           │
 │   (drop the 0020 auto-promote trigger so posting no longer self-promotes)   │
 └──────────────────────────────────────────────────────────────────────────┘
```

**The security boundary is the database.** The `ss*` pure functions decide UI/UX and are the spec
the SQL re-validation honors — they are never the enforcement point. Every state-changing path runs
through a `SECURITY DEFINER` RPC that (a) authorizes via `ss_is_admin()`, (b) checks preconditions,
(c) mutates state and appends the audit row **atomically, in one transaction**.

### New table vs. extend `users`? (decision)

**Decision: a new `curator_application` table; `users` gains only the additive `is_admin` column.**
An application is a first-class, multi-instance, historical record (a rejected applicant reapplies →
a *new* row; the old one is retained — Req 7.2/11.4). That cannot live as flags on the single
`users` row. This mirrors the `0029` decision to add `complaints` rather than overload `reports`.

### Replacing the two self-serve promotions (decision)

- **`bcActivate()`** stops writing `users.role`. It becomes the 4-step application submit that calls
  `ss_submit_curator_application`. `ssBuildOnboardingPatch()` (handle/bio/genres/avatar) is retained
  only for the profile fields it always wrote — it must **not** include `role`.
- **Migration `0020`'s `on_content_promote_curator` trigger is dropped** in `0034` (Phase 3), so a
  `content` insert no longer promotes its author. Dropping/recreating a trigger is permitted under
  the additive rule (which forbids dropping *tables/columns*, not functions/triggers/policies).

## Components and Interfaces

### Pure decision helpers (`showshak-shared.js` — DOM-free, never throw, dual-exported, fast-check-tested)

Each helper is added to BOTH the `if (typeof window !== 'undefined')` block and the
`module.exports` block (the established pattern), tolerates malformed input by returning a safe
value rather than throwing, and is the spec its server-side SQL twin must honor.

```js
// ── Req 2 (Application_Validator) ─────────────────────────────────────────────
ssValidateCuratorApplication(payload) -> { ok: boolean, missing: string[] }
// Stable key order: ['applicant_info','genres','social_link','terms'].
// well-formed IFF ALL hold:
//   applicant_info : payload.applicant is an object with a non-empty (trimmed) identity
//                    field (name OR username), length >= 1                       (Req 2.1)
//   genres         : Array.isArray(payload.genres) AND 1 <= genres.length <= 6   (Req 2.1/2.5)
//   social_link    : typeof string AND trim().length >= 1                        (Req 2.1/2.3)
//   terms          : payload.termsAccepted === true  (STRICT boolean)            (Req 2.1/2.4)
// reference_clip is OPTIONAL: its presence/absence never affects ok             (Req 2.2)
// ok === (missing.length === 0); missing lists each failing key in fixed order  (Req 1.4)
// null/undefined/non-object payload → { ok:false, missing:[all four keys] }.
// PURE: no DOM, no network, no Supabase; never mutates input; deterministic     (Req 2.6)

// ── Req 8 (State_Machine) ─────────────────────────────────────────────────────
ssCuratorAppTransition(from, to) -> boolean
// Returns true for EXACTLY these transitions, false for everything else:
//   ('pending','approved') -> true          (Req 8.2)
//   ('pending','rejected') -> true          (Req 8.2)
// ANY other pair — 'approved'/'rejected' as `from` (terminal, Req 8.3/8.4),
//   unknown states, self-loops, 'pending'->'pending' — returns false (Req 8.5).
// Total over all inputs (incl. null/undefined/non-string); never throws (Req 8.6).

// ── Req 15 (Badge_Resolver) ────────────────────────────────────────────────────
ssResolveBadge({ role, verified }) -> 'none' | 'curator' | 'verified'
//   verified === true                         -> 'verified'  (overrides, Req 15.2)
//   else role === 'curator'                    -> 'curator'   (Req 15.1)
//   else                                       -> 'none'      (Req 15.3)
// Exactly one of the three for ANY input (Req 15.4). null/garbage input → 'none'.
// PURE, deterministic, DOM/network-free (Req 15.5).

// ── Req 13 (Admin_Authorizer) ───────────────────────────────────────────────────
ssIsAdminActor({ is_admin }) -> boolean
//   is_admin === true (STRICT boolean) -> true; else false.               (Req 13.5)
//   absent / null / 'true' / 1 / any non-strict-true value -> false.       (Req 13.6)
// null/undefined/non-object actor → false. PURE, deterministic, never throws.
```

Note the validator and admin-authorizer deliberately mirror `ssDmcaNoticeWellFormed`'s strict-boolean
and stable-`missing`-key conventions so the SQL re-validation is a line-for-line translation.

### Impure client wrappers (`showshak-shared.js`, window-only — NOT in `module.exports`)

Mirror the `0029` RPC-wrapper shape (`ssSubmitTakedown` / `ssModerateComplaint`): guard
`window.ssDB` / `window.ssCurrentUser`, fail soft, never throw.

```js
ssSubmitCuratorApplication(payload)   // client ssValidateCuratorApplication gate →
                                      //   (opt) upload Reference_Clip to private bucket →
                                      //   rpc('ss_submit_curator_application', { payload }) → {ok}|{missing}
ssMyLatestApplication()               // → select most-recent own curator_application row (own-row RLS)
ssAdminListApplications(status)       // admin → select curator_application by status (admin RLS)
ssAdminReferenceClipUrl(app_id)       // admin → rpc('ss_admin_reference_clip_url', …) → signed URL | null
ssApproveApplication(appId)           // admin → rpc('ss_approve_application', …)
ssRejectApplication(appId)            // admin → rpc('ss_reject_application', …)
ssSetCuratorVerified(userId, on)      // admin → rpc('ss_set_curator_verified', …)
```

### Server pieces (RPCs / triggers / policies — the only privileged paths)

| Server piece | Type | Purpose | Authorization / precondition |
|---|---|---|---|
| `ss_is_admin()` | `SECURITY DEFINER` sql, `stable` | privilege predicate | `true` if `service_role` OR caller's `users.is_admin` = true |
| `ss_submit_curator_application(payload jsonb)` | `SECURITY DEFINER` plpgsql | Phase 1 insert path | any `authenticated`; re-validates payload; role UNCHANGED |
| `ss_approve_application(app_id uuid)` | `SECURITY DEFINER` plpgsql | Phase 2 approve | `ss_is_admin()` AND status='pending' else no-op |
| `ss_reject_application(app_id uuid)` | `SECURITY DEFINER` plpgsql | Phase 2 reject | `ss_is_admin()` AND status='pending' else no-op |
| `ss_set_curator_verified(user_id uuid, verified boolean)` | `SECURITY DEFINER` plpgsql | Phase 2 verify | `ss_is_admin()` AND target `role='curator'` |
| `ss_admin_reference_clip_url(app_id uuid)` | `SECURITY DEFINER` plpgsql | admin review-clip read | `ss_is_admin()`; returns short-lived signed URL |
| `curator_application_log_immutable()` + triggers | trigger fn | append-only audit | rejects UPDATE/DELETE for ALL roles |
| `content_insert_own` (redefined) | RLS policy | Publish_Gate | INSERT allowed only when author `role='curator'` |

### Client surfaces

- **`showshak-profile.html`** — the "Become a Curator" CTA opens the **4-step Application_Form**
  (Step 1 applicant info; Step 2 curator info + 1–6 genres; Step 3 `Social_Link` + optional
  `Reference_Clip`; Step 4 accept `Curator_Terms`). On submit it calls
  `ssSubmitCuratorApplication`. The instant `bcActivate` role-flip is removed. A **status panel**
  replaces the CTA when the most-recent application is `pending` (under review), or `rejected`
  (with a "Reapply" affordance); when it is `approved`, or the account is a curator, the CTA is
  gone (owner face renders instead). No application → the CTA shows.
- **`showshak-admin.html`** — a **NEW** page, gated to `is_admin` (non-admins are redirected /
  shown an empty state; RLS guarantees zero rows regardless). Layout: a **New/Pending** list
  (each row shows captured info + `Social_Link` + the review-only `Reference_Clip` via a signed
  URL, with **Approve**/**Reject**), a **Rejected** record group (historical, read-only), and a
  **Curators** list (`role='curator'`) each with a **Make-Verified** toggle reflecting current
  `verified`. Actions call the three privileged RPC wrappers.
- **Badge rendering** — `ssResolveBadge` drives the pill on the profile hero, the feed clip overlay,
  and clip cards on Discover / Watchlist / profile. The surfaces render only the resolved badge
  value and never a count.

## Data Models

All new tables follow repo conventions — `uuid` PK (`gen_random_uuid()`),
`created_at`/`updated_at`/`deleted_at`, `meta jsonb default '{}'` — **except the audit log**, which
is append-only and therefore has **no `updated_at`/`deleted_at`** (those would imply the mutability
its trigger forbids). All timestamps are UTC (`timestamptz`). The schema is designed complete up
front (Phase 2 audit table included) even though it is applied in phased migrations, so it never
needs reshaping mid-feature. The audit table references applicant/curator/application by **plain
uuid with no FK**, so it outlives what it describes (Req 14.4).

### Migration `0034` — Phase 1: application table + submit RPC + `is_admin` + `ss_is_admin()` refine

```sql
-- ── users.is_admin (additive column; the per-user admin flag) — Req 13/admin bootstrap ──
alter table public.users add column if not exists is_admin boolean not null default false;

-- ── curator_application — Req 1,6,7,8. One row per submitted application. ──
create table if not exists curator_application (
  id             uuid primary key default gen_random_uuid(),
  applicant_id   uuid not null references users(id),          -- = auth.uid() at submit (Req 1.3)
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),   -- Application_Status (Req 8.1)
  -- captured step fields (Step 1 applicant info + Step 2 curator info)
  applicant_info jsonb not null default '{}',                 -- name/username/age/etc snapshot (Step 1)
  curator_info   jsonb not null default '{}',                 -- bio/pitch and Step-2 curator info
  genres         text[] not null default '{}',                -- 1..6 selected genres (Req 2.1/2.5)
  social_link    text not null,                               -- Step 3 primary field (Req 1.2/2.3)
  -- optional REVIEW-ONLY reference clip pointer into the private bucket (Req 3) — never a content id
  reference_clip_path text,                                   -- Storage object path in 'review-clips' bucket; null when omitted
  terms_version  text not null,                               -- accepted Curator_Terms version (Req 1.6)
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create index if not exists idx_curapp_applicant on curator_application (applicant_id, created_at desc);
create index if not exists idx_curapp_status    on curator_application (status, created_at desc);
```

`reference_clip_path` is a **Storage object path** (e.g. `review-clips/<applicant_id>/<uuid>.mp4`),
never a `content.id` and never a Mux `playback_id` (Req 3.1/3.2). "Most recent application"
(Req 6.4/7) is `order by created_at desc limit 1` for a given `applicant_id`.

### Migration `0035` — Phase 2: append-only audit table + decision RPCs

```sql
-- ── curator_application_log — Req 14. Append-only, immutable. No updated_at/deleted_at. ──
-- Modeled EXACTLY on 0029 moderation_log: no FKs (log outlives applicants/curators/applications),
-- BEFORE UPDATE/DELETE reject triggers make immutability a property of the TABLE (all roles).
create table if not exists curator_application_log (
  id             uuid primary key default gen_random_uuid(),
  action_type    text not null check (action_type in ('approved','rejected','verified','unverified')), -- Req 14.1
  application_id uuid,                        -- affected Application_Row (no FK — Req 14.4)
  applicant_id   uuid,                        -- affected applicant/curator (no FK — Req 14.4)
  actor_id       uuid,                        -- acting admin (no FK)
  occurred_at    timestamptz not null default clock_timestamp(),  -- UTC, ms precision (Req 14.1)
  detail         jsonb not null default '{}', -- e.g. {from,to,verified}
  created_at     timestamptz default now()
  -- NO updated_at / deleted_at — append-only (Req 14.2/14.3).
);
create index if not exists idx_curlog_application on curator_application_log (application_id, occurred_at);
create index if not exists idx_curlog_applicant   on curator_application_log (applicant_id, occurred_at);
```

Migration `0036` (Phase 3) adds no new tables — it redefines the `content` insert policy
(Publish_Gate) and drops the `0020` auto-promote trigger. Grandfathering requires **no data
migration**: an account already `role='curator'` simply satisfies both the badge resolver and the
Publish_Gate with no `curator_application` row — the design's default treatment *is* grandfathering.

## RLS Policies

RLS is the enforcement boundary. Admin identity resolves through the refined `ss_is_admin()`.

```sql
-- ── ss_is_admin() refinement — recognize the per-user is_admin flag (admin bootstrap) ──
-- Drop-and-recreate (idempotent). SECURITY DEFINER + locked search_path, as in 0029.
-- Reads the CALLER'S users row; true for service_role OR an authenticated user whose
-- is_admin flag is strictly true. Conservative: any error/absent → false (coalesce).
create or replace function ss_is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(auth.role() = 'service_role', false)
      or coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false);
$$;

-- ── curator_application: owner may read own; admins read all; nobody else. ──
-- NO direct insert policy — inserts go ONLY through ss_submit_curator_application (SECURITY DEFINER),
-- which sets applicant_id = auth.uid() server-side. NO update/delete for normal roles.
alter table curator_application enable row level security;
drop policy if exists curapp_read_own on curator_application;
create policy curapp_read_own on curator_application
  for select using (applicant_id = auth.uid());          -- Req 6.2 (applicant sees own status)
drop policy if exists curapp_admin_read on curator_application;
create policy curapp_admin_read on curator_application
  for select using (ss_is_admin());                       -- Req 9 (admin reads all)
-- Result: a Normal_User/Guest SELECT that is neither owner nor admin returns ZERO rows (Req 13.4).

-- ── curator_application_log: admin-only read; append-only for EVERY role. ──
alter table curator_application_log enable row level security;
drop policy if exists curlog_admin_read on curator_application_log;
create policy curlog_admin_read on curator_application_log
  for select using (ss_is_admin());                       -- Req 13.4 (zero rows for non-admins)

create or replace function curator_application_log_immutable() returns trigger
  language plpgsql as $$
begin
  raise exception 'curator_application_log is append-only (% rejected)', tg_op;   -- Req 14.2
end; $$;
drop trigger if exists trg_curlog_no_update on curator_application_log;
create trigger trg_curlog_no_update before update on curator_application_log
  for each row execute function curator_application_log_immutable();
drop trigger if exists trg_curlog_no_delete on curator_application_log;
create trigger trg_curlog_no_delete before delete on curator_application_log
  for each row execute function curator_application_log_immutable();
-- BEFORE trigger fires for table owner + service_role too → immutability is a TABLE property,
-- not merely an RLS policy a privileged role could bypass (Req 14.2, mirrors 0029 moderation_log).

-- ── users: block direct self-promotion (the security spine). ──
-- No UPDATE grant/policy is added for authenticated on users.role/users.verified by this feature.
-- role/verified change ONLY through the SECURITY DEFINER RPCs below (Req 13.1/13.3). If any
-- broad users-update policy exists from earlier migrations, 0034 tightens it with a WITH CHECK
-- that forbids a caller changing their own role/verified/is_admin (documented at apply time).
```

### Publish_Gate (Phase 3, migration `0036`) — RLS on `content`

```sql
-- Redefine the 0012 insert policy so ONLY an approved curator may create a clip (Req 18).
-- The role check runs in RLS, so it holds for ANY direct data-API insert, not just the UI.
drop policy if exists content_insert_own on public.content;
create policy content_insert_own on public.content
  for insert with check (
    creator_id = auth.uid()                                 -- can only publish as self (0012 invariant)
    and exists (                                            -- AND must be an approved curator (Req 18.1)
      select 1 from public.users u
       where u.id = auth.uid() and u.role = 'curator'
    )
  );

-- Stop self-promotion on post: drop the 0020 trigger so publishing no longer flips role (Req 18.4).
drop trigger if exists on_content_promote_curator on public.content;
-- A User_Role account (incl. one with a pending/rejected application) therefore CANNOT insert a
-- live clip: the WITH CHECK fails → the write is rejected under RLS (Req 18.2/18.4). A
-- Grandfathered_Curator (role already 'curator') passes unchanged (Req 17.3).
```

### Review-only reference clip — private bucket design (Req 3)

The `Reference_Clip` lives in a **private Supabase Storage bucket** named `review-clips`
(`public = false`) — objects in it are NOT servable by URL and have NO Mux asset/playback id, so
there is no path by which it becomes a feed clip.

```sql
-- Create the private bucket (idempotent). Never public.
insert into storage.buckets (id, name, public)
values ('review-clips','review-clips', false)
on conflict (id) do nothing;

-- storage.objects RLS for this bucket:
--  • Applicant may INSERT (upload) only under their own uid prefix: review-clips/<auth.uid()>/...
--  • Applicant may NOT read back (review-only; not even the owner surfaces it — Req 3.5).
--  • Admins may read via ss_is_admin() (or via the signed-URL RPC below).
drop policy if exists reviewclip_owner_insert on storage.objects;
create policy reviewclip_owner_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'review-clips'
    and (storage.foldername(name))[1] = auth.uid()::text     -- own-prefix only
  );
drop policy if exists reviewclip_admin_read on storage.objects;
create policy reviewclip_admin_read on storage.objects
  for select using (bucket_id = 'review-clips' and ss_is_admin());   -- Req 3.3
```

**Upload flow:** the client (Step 3, only when a clip is supplied) uploads the file to
`review-clips/<auth.uid()>/<uuid>.<ext>` via the Storage client, then passes that object path as
`payload.reference_clip_path` into `ss_submit_curator_application`. The RPC stores the path only —
it never creates a `content` row and never assigns a Mux id (Req 3.1/3.2).

**Admin read:** the console never embeds a public URL. It calls `ss_admin_reference_clip_url(app_id)`
(`SECURITY DEFINER`, `ss_is_admin()`-gated) which returns a **short-lived signed URL** for the
stored object; the admin-read Storage policy is the backstop. No guest/applicant/normal-user surface
ever renders it, at any status (Req 3.3/3.4/3.5).

### Privileged RPCs (signatures + exact behavior)

All: `SECURITY DEFINER`, `set search_path = public`, `create or replace` (idempotent),
`grant execute` to the right roles, trailing `notify pgrst, 'reload schema';`.

```sql
-- ── ss_submit_curator_application(payload jsonb) → jsonb  (any authenticated; Req 1,2,5) ──
-- The ONLY insert path (no insert policy on the table). VALIDATES in SQL mirroring
-- ssValidateCuratorApplication (applicant_info present; 1..6 genres; social_link trim>=1;
-- termsAccepted strictly true). On invalid → RAISE, insert NOTHING. On valid → insert ONE row:
--   applicant_id = auth.uid(), status='pending', genres, social_link, reference_clip_path (nullable),
--   terms_version = payload->>'terms_version'. Leaves users.role UNCHANGED (Req 1.5/5.3).
-- Returns { application_id, status:'pending' }. grant execute to authenticated.

-- ── ss_approve_application(app_id uuid) → jsonb  (admin; Req 10,13,14) ──
-- 1) if NOT ss_is_admin() → return no-op result, change NOTHING (Req 13.2).
-- 2) lock the row; if status <> 'pending' → no-op, NO role/status change (Req 10.4).
-- 3) in ONE transaction: update users.role='curator' WHERE id = application.applicant_id (that one
--    row only — Req 10.5); update application.status='approved'; insert ONE curator_application_log
--    row (action_type='approved', application_id, applicant_id, actor_id=auth.uid()). Any failure
--    rolls back the whole txn (Req 10.2/14.5). Guarded by ssCuratorAppTransition('pending','approved').

-- ── ss_reject_application(app_id uuid) → jsonb  (admin; Req 11,13,14) ──
-- Same authorization + precondition shape. On a pending row: update status='rejected'; leave
-- users.role UNCHANGED (Req 11.1); insert ONE log row (action_type='rejected'). Non-pending → no-op
-- (Req 11.3). Prior rejected rows are retained as history (Req 11.4). One txn (Req 11.2/14.5).

-- ── ss_set_curator_verified(user_id uuid, verified boolean) → jsonb  (admin; Req 12,13,14) ──
-- 1) if NOT ss_is_admin() → no-op (Req 13.2). 2) only when target users.role='curator' (Req 12.3),
--    else no-op. 3) one txn: update users.verified = verified; insert ONE log row
--    (action_type = verified ? 'verified' : 'unverified'). Rolls back on failure (Req 12.4/14.5).

-- ── ss_admin_reference_clip_url(app_id uuid) → text  (admin; Req 3.3) ──
-- if NOT ss_is_admin() → return null. Else resolve application.reference_clip_path and return a
-- short-lived signed URL for that private object. Never returns a public URL.
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The security spine, the review-only-clip guarantee, the transactional RPCs, and the RLS gates are
**database/integration concerns** — they are verified with focused integration tests (see Testing
Strategy), not property-based tests, because their behavior does not vary meaningfully with
generated input and running them 100× adds no coverage. Property-based testing is reserved for the
four **pure decision helpers** in `showshak-shared.js`, which are the executable specification the
SQL re-validation must honor. After reflection, each helper condenses to exactly one comprehensive
property (per-case acceptance criteria are exercised by the generators, not split into separate
properties).

### Property 1: Application validator well-formedness

*For any* application payload (well-formed, malformed, partial, or non-object),
`ssValidateCuratorApplication` returns `{ ok, missing }` where `ok === (missing.length === 0)`,
`missing` lists exactly the failing keys among `['applicant_info','genres','social_link','terms']`
in that fixed order, a payload is classified well-formed exactly when applicant info is present AND
genres count is within 1..6 AND `social_link` is non-empty after trimming AND `termsAccepted` is
strictly boolean `true`, the presence or absence of a reference clip never changes the result, and
the call never throws and never mutates its input.

**Validates: Requirements 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 2: Application state machine totality and correctness

*For any* pair of values `(from, to)` — including valid statuses, unknown strings, and
null/undefined — `ssCuratorAppTransition(from, to)` returns `true` if and only if `(from, to)` is
`('pending','approved')` or `('pending','rejected')`, and returns `false` for every other pair
(terminal `approved`/`rejected` origins, self-loops, and unknown values), deterministically and
without throwing.

**Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6**

### Property 3: Badge resolution

*For any* `{ role, verified }` input (including malformed or missing fields),
`ssResolveBadge` returns exactly one value from `{ 'none', 'curator', 'verified' }`, resolving to
`'verified'` whenever `verified === true` (overriding curator), otherwise `'curator'` whenever
`role === 'curator'`, otherwise `'none'`, deterministically and without throwing.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**

### Property 4: Admin authorizer

*For any* actor value (object with any `is_admin` value, or null/undefined/non-object),
`ssIsAdminActor` returns `true` if and only if the actor's `is_admin` field is strictly boolean
`true`, and `false` for every other value (absent, null, `'true'`, `1`, or any non-strict-true
value), deterministically and without throwing.

**Validates: Requirements 13.2, 13.5, 13.6**

## Error Handling

- **Pure helpers never throw.** Malformed input yields a safe value: the validator returns
  `{ ok:false, missing:[…] }`, the state machine returns `false`, the badge resolver returns
  `'none'`, the authorizer returns `false`. This is the contract the property tests enforce and the
  reason the client can call them defensively without try/catch.
- **Client RPC wrappers fail soft.** Following the `0029` pattern, each wrapper guards
  `window.ssDB` / `window.ssCurrentUser`, returns a safe null/`{missing}` result, and never throws,
  so guests/offline and pre-migration states keep the app working.
- **RPC validation is defense-in-depth.** `ss_submit_curator_application` re-validates in SQL
  mirroring the pure validator; a malformed payload raises and inserts nothing (no application row).
  The browser gate is UX only.
- **Authorization/precondition failures are silent no-ops, not errors.** A non-admin call, or an
  approve/reject of a non-pending row, changes nothing and returns a no-op result (Req 10.4/11.3/
  13.2) — no partial mutation, no audit row.
- **Transactional atomicity.** Approve/reject/verify perform mutation + status + one audit append in
  a single transaction; any failure rolls the whole thing back, so `role`/`verified`/status never
  persists without its audit row and no audit row persists for a failed action (Req 10.2/11.2/12.4/
  14.5).
- **Audit immutability is enforced at the table.** Any UPDATE/DELETE on `curator_application_log`
  raises from the BEFORE trigger for every role including `service_role` (Req 14.2).
- **Publish gate rejects, not crashes.** A `User_Role` insert into `content` fails the RLS
  `WITH CHECK` and is rejected as a permission error; the upload UI surfaces "curator status
  required" rather than crashing (Req 18.2).
- **Signed-URL failures degrade.** `ss_admin_reference_clip_url` returns `null` for a non-admin or a
  missing object; the console shows "clip unavailable" rather than leaking any path.

## Testing Strategy

**Dual approach.** Property-based tests verify the four pure helpers across generated inputs;
integration and example tests verify the database/RLS/RPC/Storage and UI behavior that PBT is not
suited to.

### Property-based tests (Node + `fast-check`, `node tests/run-all.js`)

- Library: **`fast-check`** (already the project standard). Do NOT hand-roll property testing.
- Minimum **100 iterations** per property (the harness `tests/_pbt.js` `ITER`).
- One property-based test file per property, requiring `../showshak-shared.js` under the DOM stub
  (`installDomStub()`), mirroring `tests/prop-dmca-notice.test.js`.
- Each test is tagged with a header comment referencing its design property, in the established
  format:
  - `Feature: curator-application-approval, Property 1: Application validator well-formedness` →
    `tests/prop-curator-app-validate.test.js`
  - `Feature: curator-application-approval, Property 2: Application state machine totality and correctness` →
    `tests/prop-curator-app-transition.test.js`
  - `Feature: curator-application-approval, Property 3: Badge resolution` →
    `tests/prop-curator-badge.test.js`
  - `Feature: curator-application-approval, Property 4: Admin authorizer` →
    `tests/prop-curator-admin-actor.test.js`
- Each test uses an independent oracle (recomputing the expected result), asserts the result shape,
  determinism (same input → same output), and non-throwing/non-mutating behavior — exactly the
  `prop-dmca-notice` template. Generators deliberately include the edge cases (whitespace-only
  `social_link`, 0 and 7 genres, non-strict-true `termsAccepted`/`is_admin`, missing fields, present
  vs absent reference clip) so the per-case acceptance criteria are covered without separate tests.

### Integration / example tests (against a Supabase test project or mocked data API)

Because these verify external service behavior and configuration, they use **1–3 representative
examples**, not property iteration:

- **Submit (Req 1.3/1.5/1.6):** a well-formed `ss_submit_curator_application` call inserts exactly
  one `pending` row with `applicant_id = auth.uid()`, records `terms_version`, and leaves
  `users.role` unchanged; a malformed payload inserts nothing.
- **Approve/Reject/Verify (Req 10/11/12/14):** each RPC performs its mutation + one audit row in one
  transaction; a non-pending target and a non-admin caller are no-ops; a forced failure rolls back
  with no audit row; approve modifies only the one applicant's `users` row.
- **Security spine (Req 13.3/13.4):** a normal user's direct `update users set role/verified` is
  rejected under RLS; a non-owner/non-admin `select` on `curator_application` and any `select` on
  `curator_application_log` returns zero rows.
- **Audit immutability (Req 14.2):** UPDATE and DELETE on `curator_application_log` both raise
  (including under service role).
- **Review-only clip (Req 3):** an uploaded reference object is not a `content` row and has no Mux
  id; a non-admin cannot read it; `ss_admin_reference_clip_url` returns a signed URL only for an
  admin; approving an application leaves the object in the private bucket and creates no clip.
- **Publish gate (Req 18, 5.2, 17.3):** a `User_Role` account (including one with a pending/rejected
  application) cannot insert a live `content` row; a `curator` (approved or grandfathered) can.
- **UI examples (Req 4, 6, 9, 16, 17.4):** confirmation card copy and absence of any role-changed
  claim; profile status panel states for pending/rejected/approved/no-application; the admin
  console's New/Pending, Rejected, and Curators groupings and action buttons; badge pills on
  profile/feed/cards with no count; no CTA for grandfathered curators.

### Migration checks (Req 19) — smoke

Re-running each of `0034`/`0035`/`0036` completes without error and yields identical definitions
(idempotent drop-and-recreate of functions/triggers/policies; `add column if not exists`;
`create table if not exists`). A schema check confirms `curator_application_log` has no
`updated_at`/`deleted_at` and no foreign keys, and that no migration drops, renames, or retypes an
existing table or column. Numbering starts at `0034` and never reuses `0030`.

## Requirements Coverage Summary

| Requirement | Covered by |
|---|---|
| 1 Submit 4-step form | Application_Form (profile), `ss_submit_curator_application`, Property 1 (1.4) |
| 2 Validation | `ssValidateCuratorApplication`, Property 1 |
| 3 Review-only clip | `review-clips` private bucket + Storage RLS + `ss_admin_reference_clip_url`, integration |
| 4 Confirmation | Application_Form confirmation card, example |
| 5 Pending access | unchanged normal-user paths + Publish_Gate, integration |
| 6 Pending/status panel | Profile status panel + `ssMyLatestApplication`, example |
| 7 Resubmission | new-row-on-reapply + latest-status gate, integration |
| 8 State machine | `ssCuratorAppTransition`, Property 2 |
| 9 Admin console listing | `showshak-admin.html`, example |
| 10 Approve RPC | `ss_approve_application` (txn), integration; role→badge via Property 3 |
| 11 Reject RPC | `ss_reject_application` (txn), integration |
| 12 Verify RPC | `ss_set_curator_verified` (txn), integration |
| 13 Security spine | `ss_is_admin()` + RPC gating + RLS, integration; `ssIsAdminActor` Property 4 |
| 14 Append-only audit | `curator_application_log` + immutability triggers, integration/smoke |
| 15 Badge resolution | `ssResolveBadge`, Property 3 |
| 16 Badge rendering | profile/feed/card surfaces, example |
| 17 Grandfathering | default treatment (role=curator ⇒ approved), integration |
| 18 Publish gate | redefined `content_insert_own` RLS + dropped `0020` trigger, integration |
| 19 Additive phased migrations | `0034`/`0035`/`0036` idempotent authoring, smoke |
