# ShowShak — Pitch Deck v2 (grounded copy)

**Purpose:** Investor-ready pre-seed deck, built now, to be used *after* the Chandigarh/Tricity beta produces real numbers.
**Rule for every slide:** one idea, headline states the takeaway, ~10 words of on-slide text, the rest is spoken.
**`[FILL AFTER BETA]`** = a real number you capture during the beta (see appendix). Do NOT ship the deck with these blank — an empty traction slide reads worse than a small honest one.

Every factual claim below is grounded in what is actually built in the repo (108 green property-tests, live Mux/Supabase/TMDB stack, RLS-enforced Stacks). No adjectives that can't be shown.

---

## Slide 1 — Cover
**On slide:**
- SHOWSHAK
- Discover · Trust · Watch It
- *The trust layer for what to watch.*
- Pre-seed · India · [Month 2026]

**Speaker note:** "We turn 'what should we watch?' into watching it — in one tap, through a person you trust." (Cut the long paragraph the old cover had.)

---

## Slide 2 — The Problem  *(REVISED: friction timeline, not stat blocks)*
**Headline:** Infinite content. Zero conviction.
**On slide — visual friction timeline (5 steps, arrows):**
See a clip on Instagram → Open a browser → Google "where to watch" → Open the OTT app & search → Lose the impulse
**Bold line under it:** Entertainment is an impulse. The 6-step hunt for "where to watch" kills it — **~16 minutes lost every single session.**
**Spoken:** So the decision falls back to the oldest instinct there is — asking someone whose taste you trust.
**Sources (footer):** LiveMint 2025 · Accenture India OTT.
**Why the change:** Show the friction, don't just cite it — experience is more relatable than a data point. Kept ONE anchor stat (16 min) so the slide isn't "unquantified"; moved 69% and 148M to Why Now. Lead with *paying* subs, never the 601M free-inclusive figure.

---

## Slide 3 — The Solution
**Headline:** The person you trust, at the scale of a feed.
**On slide:** A curator clips a show — title hidden. You feel it. You trust them. You tap **Watch It** and land on the right platform. One move.
**Three micro-labels:**
- **Creator first** — you bond with the taste before the title
- **Title-hidden** — the show reveals only at the moment of decision *(real, shipped mechanic — this is the wedge)*
- **The bridge** — we carry people to Netflix, Prime, JioHotstar

**Speaker note:** The title-hidden clip is your defensible product bet — it forces trust in the curator, not recognition of the show. No competitor's format does this.

---

## Slide 4 — Product · Live Today
**Headline:** Not a mockup. A working product.
**On slide (4 proof cards):**
- **Real video** — full Mux upload→transcode→playback pipeline, live
- **Watch It** — region-aware deep-linking, works with zero platform deals
- **Stacks** — private / shared / collaborative watchlists
- **Curators, not influencers** — vanity metrics hidden at the database level

**On-slide line (founder/outcome language — NOT engineer stats):**
A live web app — real video, deep-links to any platform with zero partnerships, and built to scale.
**Beta line:** Live in open beta — **[FILL AFTER BETA: N curators, N clips]**.
**Visual:** clean screenshot of the feed + the Watch It sheet. (DocSend: product screenshots get read fastest and this slide gets the longest look at pre-seed — make it beautiful.)

**Engineering proof lives in SPEAKER NOTES / Q&A, not on the slide.** When a VC asks "is it really built / will it scale?" — that's when you deploy: *108 passing property-based tests · 37 DB migrations · load-tested to ~270 reads/sec, p95 100ms, zero errors · runs at ~$0–5/mo.* On the slide face these read as "engineer in love with the code"; in the Q&A they're a knockout. Do NOT put p95/migrations/$-per-month on the slide (esp. "$0–5/mo" — it underlines pre-traction). The slide's job is to show *execution risk is low* in plain language; the granular proof is your back-pocket answer.

---

## Slide 5 — Collaborative Stacks
**Headline:** Watching isn't solo. It's a group chat.
**On slide:**
- 6 friends. One watchlist. Real-time, attributed.
- Private → Shared → Collaborative
**Subline:** Every collab stack pulls in up to 5 more people — growth built into the feature.

**Speaker note (why this slide exists):** This is the answer to the #1 objection in this category — *"is it a habit or a utility?"* A 6-person squad co-building a watchlist is a network you can't clone. This is retention and virality in one feature, and it's already built (RLS-enforced, 6-member cap, attributed contributions).

---

## Slide 6 — Traction · Beta Signal
**Headline:** [FILL AFTER BETA — lead with your single best number]
**On slide (fill from the Chandigarh/Tricity beta):**
- **[N]** curators posting weekly
- **[N]** returning users · **[+X% week-over-week]** *(show the rate if absolutes are small — the Buffer move)*
- **[N]** Watch-It taps · **[X%]** tap-through
- **[X%]** of users return within 48h of a curator they follow posting ← *the number that proves habit*

**Speaker note:** Honest small numbers + a growth rate beat any adjective. The 48h-return metric is the one that separates you from the "what-to-watch" graveyard — instrument it from day one of the beta. If a number is still zero, don't fake it; show the ones that are real and name the next milestone.

---

## Slide 7 — Why Now
**Headline:** The #1 player just confirmed the problem.
**On slide (3 forces):**
- **Choice broke** — 148M subs fragmented across 15+ platforms
- **Trust moved to people** — 67%; 18–34s now trust creators over search
- **The AI race** — JioHotstar + OpenAI shipped ChatGPT discovery to fix "what to watch"

**Punch line:** The giant is paying to solve our exact problem — with a machine guess. We bring human trust.
**Sources:** Ormax 2025 · Nielsen 2026 · Variety/Financial Express 2026 · AppsFlyer 2026.
**Speaker note:** Lead with the Jio+OpenAI line — it's your strongest single sentence. Keep it.

---

## Slide 8 — Category & Moat
**Headline:** The trust network for what to watch.
**On slide:** 2×2 map (axes: human taste & trust × cross-platform neutrality):
- Netflix/Prime = walled gardens · JustWatch/Reelgood = cold where-to-watch data · TikTok/Reels = taste, no intent · **ShowShak = taste + action, every platform**
**One-line moat (spoken):** "A streamer that promotes rivals stops being itself — so neutrality stays ours." + we start with zero permission (public availability data, no deals needed).
**Sources:** JustWatch 60M+/mo, profitable since 2016 · Letterboxd ~29M users.
**Speaker note:** Don't cut this slide (earlier AI advice was wrong to). It's your "I'm in the surviving lineage" argument — JustWatch proves the money, Letterboxd proves the community. Fold the old Defensibility slide's neutrality point in here.

---

## Slide 9 — Market
**Headline:** The budget behind every "Watch It."
**On slide:**
- India promotion economy ≈ **₹6,000–10,000 cr/yr (~$0.7–1.2B)**
- Our wedge: the trust-discovery slice of subscriber-acquisition spend
**Subline:** We don't take a cut of subscriptions — we take a slice of what platforms already spend to acquire subscribers. Same buckets globally ≈ $50B+/yr.
**Sources:** FICCI-EY 2026 · WPP Media 2026 · studio disclosures. Ranges, not point estimates.
**Speaker note:** Kill the triangulation footnote wall and the "₹200–400 cr / 10% at maturity" SOM line — it's a vanity number your own notes warn against. One TAM number + the wedge is enough.

---

## Slide 10 — Business Model
**Headline:** We sell intent — at the moment of taste.
**On slide (lead with ONE, show the rest as a small ladder):**
- **CORE — Promoted clips:** studios fund curators to clip new titles; looks organic, recurring every release
- *Then:* performance acquisition for streamers → cross-platform taste intelligence → curator/premium
**Honest line (spoken):** Every revenue line is gated behind scale and data — nothing monetizes off a prototype. This raise buys the data.
**Speaker note:** Don't give four revenue streams equal weight — VCs read that as "no focus." One core, three as a maturity ladder.

---

## Slide 11 — Team
**Headline:** Built by the buyer.
**On slide:**
- **Piyush Gupta — Founder.** B.Tech (IT). Performance marketer, managed **₹1 cr+** in Google Ads spend — **[FILL: ROAS / result number]**. Built this entire live, tested product solo.
- Bringing on: streaming partnerships + senior engineering for scale.
**Punch line:** ShowShak's customer is a performance marketer buying attention. I've *been* that buyer — I know exactly what converts and what they'll pay for.
**Speaker note:** The ROAS number is, per your own talk-track, the single most powerful line on this slide — and it's currently blank. Fill it. Frame solo-build as capital efficiency, but be ready for the "solo/non-technical" question.

---

## Slide 12 — The Ask
**Headline:** Raising ₹1 crore to prove the loop.
**On slide:**
- **The milestone:** [N] curators posting weekly + [N] returning users trusting them + the first Watch-It conversion data that opens OTT deal conversations.
- **Use of funds:** Founding curator cohort · Team (partnerships + engineering) · Runway to beta proof
**GTM one-liner (spoken):** Start hyperlocal — Chandigarh + Tricity colleges, word-of-mouth first — then the organic rail becomes the paid rail.
**Speaker note:** Cut "Legal & entity" from use-of-funds (never itemize company formation). Say "deal *conversations*," never "signed deals." The hyperlocal Chandigarh start is a strength — it's a specific, credible beachhead, not hand-waving.

---

## Slide 13 — Close
**On slide:** SHOWSHAK · The trusted bridge to everything you watch. · [live app link] · hello@showshak.com
**Speaker note:** The live app link is your single strongest asset — but only turn it on once the beta has real (not demo) data in it.

---

# Appendix — numbers to capture during the Chandigarh/Tricity beta

Instrument these from day one; they fill the `[FILL AFTER BETA]` slots and pre-empt the "you're just another Likewise" objection:

1. **Curators onboarded / posting weekly** (target 10–15 → show weekly-active, not just signed-up)
2. **Clips posted** (total + per-curator)
3. **Returning users** + **week-over-week growth %** (rate matters more than absolute at this size)
4. **Week-1 and week-2 retention %**
5. **★ % of users who return within 48h of a curator they follow posting** — the survival metric; the single most important number in the deck
6. **Watch-It taps** + **tap-through rate** (taps ÷ clip views)
7. **Avg clips saved per active user** + **collab stacks created**
8. **Invite → join conversion** on collab stacks (proves the viral loop)
9. **Founder ROAS** from the ₹1 cr+ Google Ads history (team slide)

Small and honest beats big and fake. 12 curators and "+30% WoW returning users" gets a meeting; "50–100 curators" with demo data does not.
