# ShowShak — Full Product Audit & Build Roadmap

> Deep end-to-end review of the current prototype (all pages, desktop + mobile,
> user + creator flows). Written as a cofounder doing a brutally honest walkthrough.
> **Nothing here is auto-applied.** This is the map — you decide what we build and
> in what order when you're back.

**Bottom line up front:** This is a strong, polished *prototype of the viewer
experience*. But it is **not a complete product** — the entire **creator half does
not exist** (no way to upload a clip), several buttons are decorative (Follow,
comments, mute), and the pieces that make it *spread* (shareable links that lead
somewhere, real accounts) aren't wired. Below is everything, triaged.

---

## 0. How I rated severity

| Tag | Meaning |
|-----|---------|
| 🔴 **P0 — Blocker** | The product can't really function / launch without it |
| 🟠 **P1 — Major** | Core experience feels broken, fake, or incomplete |
| 🟡 **P2 — Polish** | Noticeable rough edge; improves trust & feel |
| 🔵 **P3 — Later** | Nice-to-have / scale-stage |

---

## 1. 🔴 THE BIG MISSING HALF — Creators can't create

This is the headline. ShowShak is a *curator* platform, and **there is currently no
way for a curator to post a clip.** The entire supply side is absent.

- 🔴 **No upload page exists.** There is no `showshak-upload.html` or equivalent.
- 🔴 **No upload entry point anywhere.** Profile "Creator mode" shows clips, analytics,
  and a mode toggle — but there is **no "+" / "Post a Clip" / "Upload" button** on the
  profile, the sidebar, or the mobile nav. A creator literally has no door in.
- 🔴 **The whole creator content pipeline is missing**, per our own `overview` content
  model. A real upload flow needs:
  1. Upload / select the clip (video).
  2. Write the caption / pitch (required, ~70–90 words per our locked spec).
  3. **Pick the show** (one tap — the search-and-select that powers Watch It).
  4. Optional **vibe** picker (1–3 from the fixed mood set).
  5. Set the platform(s) it's available on (or derive from the picked show).
  6. Preview → Publish.
- 🟠 The profile's clips grid and analytics are **100% mock data** (`MOCK_CLIPS`,
  `CHART_DATA`) — nothing a creator posts would ever appear.

**Why it matters:** Without this, we can't run "Founding Week," can't onboard a single
real curator, and can't test the core loop. **This is the #1 thing to build next.**

---

## 2. 🔴 / 🟠 Core interactions that are fake or dead-ended

Things that *look* functional but aren't — these quietly destroy trust in a demo.

- 🔴 **Shared links lead nowhere.** `ssShareStack()` generates a `#stack=...` URL and
  `ssShare()` shares the page URL, but **no page reads those params** to open the
  shared Stack/clip for the recipient. A friend who taps a shared link lands on a
  generic page, not the thing that was shared. This breaks the *entire growth loop*
  we said sharing was for.
- 🔴 **No real accounts / auth.** Onboarding's "Continue with Google/Apple/Email" are
  cosmetic (`handleAuth` just animates). There's no identity, so nothing persists per
  user, follows mean nothing, and a creator has no account to post from.
- 🟠 **Follow buttons are decorative everywhere.** Feed, clip viewer, discover cards,
  profile — "+ Follow" / "Following" have **no state, no persistence, no following
  system.** Per our own strategy, *"first follow"* is the retention metric — and it
  currently does nothing.
- 🟠 **Onboarding choices are thrown away.** The genres (`selG`) and platforms (`selP`)
  the user carefully selects are **never saved**. The feed doesn't use them; the Watch
  It sheet's "Included in your plan" is hardcoded, not based on what they picked. The
  whole onboarding is theater right now.
- 🟠 **No comments.** Clips have Fire / Save / Share / Watch It but **no comment/
  discussion affordance.** For a *trust-and-connection* product, the curator↔viewer
  conversation is a notable gap (decide if this is in-scope or deliberately out).
- 🟠 **"Mute / Sound on" is fake.** The feed has a mute badge and `toggleMute()` toast,
  but clips are **CSS gradients, not real videos** — there is no audio or video element
  at all. Fine for a visual prototype; must be named as a known limitation.
- 🟡 **Rename Stack** = "coming soon" toast. Minor, but it's a visible dead end in a
  core flow.

---

## 3. 🟠 The Profile page — confirmed "cheap" feel + the redesign isn't live

- 🟠 You were right that it reads like a generic YouTube/social channel (flat gradient
  cover banner + circle avatar). The **"Curator's Marquee" redesign exists** as
  `profile-redesign-preview.html` but is **not ported** onto the real
  `showshak-profile.html`. Decision needed: approve the preview, then port it.
- 🟠 The redesigned profile also already contains the **Highlights/Collections shelf**
  (shareable Stacks with public / friends&family / private). That visibility model is
  **designed but not built** into the real Stacks engine.
- 🟡 **Dead CSS:** after we removed platform badges from cards, the classes
  `.clip-grid-plat`, `.fire-grid-plat`, `.wl-clip-plat`, `.rec-clip-plat`,
  `.clip-thumb-plat`, `.result-clip-thumb-plat` are now unused. Harmless but should be
  swept so stylesheets stay lean.

---

## 4. 🟠 The landing page (`index.html`) — off-brand & disconnected

- 🟠 **Vocabulary drift vs. our locked `overview`:** the marketing page still says
  **"WATCH NOW"** (twice) and **"WISHLIST"** — but our vocabulary is **"Watch It"** and
  **"Watchlist."** This is the *first thing* a visitor or investor reads. Must be fixed.
- 🟠 **Onboarding doesn't carry into the app** (see §2 — picks aren't saved).
- 🟡 **Not refactored to shared CSS/JS** (known). It re-inlines its own SVG + tokens,
  and has a slightly different `--border` value. Drift risk as the brand evolves.
- 🟡 **Hero section markup looks thin/unbalanced** — the hero only has a "Learn More"
  ghost button (the primary CTA lives only in the splash above and the CTA band below).
  Worth a structural once-over.
- 🟡 Splash stats ("14 min", "19%", "11+") are presented as fact — fine for a pitch
  site, but flag them as illustrative.

---

## 5. 🟡 Navigation consistency (cross-page)

- 🟡 **Source-level duplicate `active` state** still exists on **Discover** (both the
  Discover *and* Profile sidebar items are hardcoded `active` in the source).
  `highlightActiveNav()` in `shared.js` masks it at runtime, so users don't see it —
  but it's latent debt. The real fix is **Nav Consolidation** (below).
- 🟡 **~250 lines of duplicated nav markup.** The sidebar + mobile bottom nav are
  copy-pasted into all 4 pages. We agreed to inject them from `shared.js` (like the
  Watch It sheet / Stack sheet / clip viewer already are). This deletes the duplicate-
  active bug class entirely and makes every page file dramatically cleaner.
- 🟡 **Settings** is a "coming soon" toast on every page — no settings page exists.

---

## 6. 🟡 Accessibility & technical hygiene

- 🟡 **`user-scalable=no`** on every page's viewport meta — blocks pinch-zoom, an
  accessibility problem and an app-store/review red flag.
- 🟡 **Icon-only buttons lack `aria-label`s** (nav arrows, action rail, close, share,
  opts) — screen-reader users get nothing.
- 🟡 **Low contrast:** `--gray2` (#5A5A72) on `--bg` (#0B0B0F) is below WCAG AA for
  small text; it's used widely for labels/metadata.
- 🟡 **No keyboard focus styles** beyond defaults; the clip viewer/sheets aren't focus-
  trapped.
- 🔵 No `prefers-reduced-motion` handling (we lean heavily on animation).

---

## 7. 🟡 Growth / shareability hygiene (cheap, high-impact)

- 🟡 **No Open Graph / Twitter card meta, no `<meta name="description">`, no favicon**
  on any page. Every shared ShowShak link previews as a **blank box** — directly
  undercutting the sharing growth loop we just built. This is a *growth bug disguised
  as missing tags* and is a ~1-hour fix.
- 🟡 No page `<title>` differentiation issues (those are fine), but the social layer is
  the gap.

---

## 8. 🔵 Data / persistence (intentional for now, listed for completeness)

- 🔵 **`sessionStorage` only** (`ss_stacks_v1`) — resets when the tab closes. *You chose
  this deliberately for testing.* When we move to demo/real users, it's a find-replace
  to `localStorage`, then a real backend.
- 🔵 **No backend, no database** — everything is mock arrays per page. Expected at this
  stage; flagged so it's a conscious milestone, not a surprise.
- 🔵 **"For You" / "Recommended" / clip-viewer "related" are not personalized** — they
  shuffle or match on a single shared genre. Real algorithm is a later build.
- 🔵 **Watch It is simulated** — it shows a toast, not a real deep link. Per strategy,
  real deep links + TMDB availability is a defined next-phase build (no partnerships
  needed to start).

---

## 9. Smaller polish notes (quick wins)

- 🟡 Discover featured/for-you/result cards: after badge removal, double-check vertical
  spacing didn't leave a visual gap top-right.
- 🟡 Feed desktop: the action rail is JS-positioned off the clip column
  (`positionRail`) — verify it stays aligned at odd window widths / on zoom.
- 🟡 Clip viewer caption is clamped to 3 lines but our caption spec is 70–90 words —
  needs a **"…more" expand** in the viewer (already flagged in `overview`).
- 🟡 The clip viewer "related" set is built from whatever array the page passes; on
  Profile it's `MOCK_CLIPS`/`MOCK_FIRES`, so "more like this" can feel arbitrary.
- 🟡 Empty states exist for Watchlist (nice) but **not** for: no search results edge
  cases beyond the basic one, no "you follow nobody yet," no "no clips posted yet"
  (creator).
- 🟡 Toic: consistent loading states are absent (everything renders instantly from mock
  data; real data needs skeletons/spinners).

---

## 10. What's genuinely GOOD (don't touch / protect)

So the audit is balanced — these are strengths to preserve:

- ✅ The **design system** (tokens, type, restrained red) is consistent and premium.
- ✅ The **universal systems in `shared.js`** (Stacks, Watch It sheet, clip viewer,
  swipe-to-close, bfcache guard) are well-architected and reused cleanly.
- ✅ The **Feed** is the strongest surface — interactions (fire burst, CTA fire-flash,
  progress, snap-scroll) feel real and intentional.
- ✅ The **Watchlist empty state** and **Stack save flow** are genuinely nice UX.
- ✅ The **mobile clip layout fix** and **save-sheet auto-close** are solid.

---

## 11. Recommended build order (my cofounder vote)

Grouped so we ship coherent chunks, not scattered fixes.

### PHASE 1 — "Make the product whole" (the creator half) 🔴
1. **Creator Upload flow** — the missing half. New page/flow: clip + caption + pick-show
   + vibe + platform → publish. Add the **upload entry point** (sidebar, mobile nav,
   profile). *This unblocks Founding Week.*
2. **Real-ish accounts** — even lightweight identity so posts/follows/saves persist per
   user (can be `localStorage`-backed before a real backend).
3. **Make Follow real** — state + persistence; optimize onboarding/first session for the
   "first follow" metric.

### PHASE 2 — "Make it spread" 🔴🟠
4. **Public shared-link landing** — opening a shared Stack/clip actually shows it
   (read the `#stack=` / clip params). Completes the growth loop.
5. **Stack visibility model** (public / friends&family / private) wired into the real
   Stacks engine — pairs with the profile Highlights shelf.

### PHASE 3 — "Make it feel finished" 🟠🟡
6. **Port the Profile redesign** (Curator's Marquee) onto the real profile.
7. **Nav consolidation** — inject sidebar + mobile nav from `shared.js`; kills the
   duplicate-active debt and ~250 lines of dupe.
8. **Fix index.html** — vocabulary (Watch It / Watchlist), wire onboarding persistence,
   tidy hero, optionally adopt shared CSS/JS.

### PHASE 4 — "Cheap wins + hygiene" 🟡
9. **Share/SEO meta + favicon** across all pages (1 pass, big growth unlock).
10. **Accessibility pass** — aria-labels, contrast, allow zoom, focus styles.
11. **Sweep dead CSS** (the old platform-badge classes).

### LATER 🔵
12. Comments/discussion (decide if in-scope), notifications, settings page, real Watch It
    deep-linking + TMDB availability, real recommendation algorithm, backend + DB,
    `localStorage`→server migration, intent-data instrumentation (start early per strategy).

---

## 12. Direct answers to your two callouts

- **"We don't have the uploading page for the creator"** → Correct, and it's the single
  biggest gap. It's **P0, Phase 1, item #1.**
- **"We don't have the upload button in the creator profile"** → Correct — there is no
  upload entry point *anywhere* (profile, sidebar, or mobile nav). Bundled with the
  upload flow above.

---

*Generated during the overnight audit. Pushed to a branch + PR only — `main` and the
live site are untouched. Review, then tell me which phase to start and I'll build it.*
