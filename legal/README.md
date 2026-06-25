# ShowShak — Legal Documents (Beta)

> **STATUS: DRAFT — COUNSEL REVIEW REQUIRED BEFORE WIDE LAUNCH.**
> These are comprehensive, India-aware working drafts prepared to be operational
> for an **open beta launched in India only** (the website is publicly accessible;
> clip upload is limited to an invited curator cohort). They are *not* a
> substitute for sign-off by a licensed Indian advocate. Have an IP/technology
> lawyer review them (especially the copyright, intermediary, and children/age
> sections) before opening the service beyond the invited beta cohort. Nothing
> here is legal advice.

## What these documents are

Four canonical policy documents, written as the single source of truth for
ShowShak's legal surfaces. The in-app page `showshak-legal.html` renders these
(today as placeholder copy; once counsel signs off, seed the final text into the
`policy_versions` table — see the `dmca-moderation-scaffolding` spec).

| File | Surface (`showshak-legal.html?doc=`) | Governs |
|---|---|---|
| `terms-of-service.md` | `tos` | The agreement to use ShowShak; curator responsibility + attestation; 18+; beta terms |
| `privacy-policy.md` | `privacy` | What personal data we collect, why, who processes it, your DPDP rights |
| `copyright-policy.md` | `copyright` | Notice-and-takedown (Copyright Rules 2013 Rule 75 + IT Act §79); Grievance Officer; repeat-infringer |
| `community-guidelines.md` | `community` | Acceptable use; prohibited content (IT Rules 2021 Rule 3(1)(b)); repeat-infringer policy |

## Legal basis (India) — what each document rests on

- **Intermediary safe harbour:** Information Technology Act, 2000, **§79** +
  **Information Technology (Intermediary Guidelines and Digital Media Ethics
  Code) Rules, 2021** ("IT Rules 2021"). ShowShak is an *intermediary* hosting
  user-uploaded clips; it does not initiate, select, or modify the content.
  Per *Shreya Singhal v. Union of India* (2015), an intermediary acts on a
  court order or government notification ("actual knowledge").
- **Not an SSMI:** the heightened obligations (Chief Compliance Officer,
  resident Nodal Contact Person, monthly compliance reports) apply only to a
  **Significant Social Media Intermediary** (≥ 50 lakh / 5 million registered
  Indian users). ShowShak's beta is far below this threshold, so only the
  **baseline due-diligence + Grievance Officer** obligations of Rule 3(1)–3(2)
  apply.
- **Grievance redressal:** IT Rules 2021 **Rule 3(2)** — a Grievance Officer
  must **acknowledge a complaint within 24 hours** and **resolve it within 15
  days**.
- **Copyright takedown:** **Copyright Act, 1957** (§51 infringement; §52(1)
  fair-dealing / transient-storage exceptions) + **Copyright Rules, 2013, Rule
  75–76** — on a compliant written complaint, the intermediary **restricts
  access within 36 hours**; the material stays disabled for **21 days** within
  which the complainant must obtain a court order, failing which access may be
  restored.
- **Data protection:** **Digital Personal Data Protection Act, 2023** ("DPDP
  Act") + **DPDP Rules, 2025** (notified **13 November 2025**; phased rollout —
  Board/admin provisions first, **Consent Manager registration ~Nov 2026**, and
  the substantive **notice/consent/rights/security/erasure obligations + penalties
  ~May 2027**). ShowShak is a **Data Fiduciary**; users are
  **Data Principals**. Consent-led processing, itemised notice, data-principal
  rights, and **verifiable parental consent for anyone under 18** (which is why
  the beta is **18+ only** — see Terms).

## Beta posture (stated in every document)

- **Open beta, India only.** ShowShak is operational only in India during the
  beta. The website is **publicly accessible** to anyone with the link; **clip
  upload (the curator/supply side) is limited to an invited cohort**, which is the
  lever that actually controls content risk.
- **Non-commercial during beta.** There is no payment, subscription, advertising,
  or monetisation in the product today. We do not sell personal data.
- **Neutral host / creator responsibility.** Curators upload their own clips and
  **attest** at upload that they hold the rights to the video and audio and
  accept responsibility + indemnity (enforced in the database — no clip goes
  live without a recorded attestation).
- **No music feature** during beta (a copyrighted-music library would risk
  inducement and is deliberately excluded).

## Placeholders YOU must fill before publishing

Search every document for `[SQUARE_BRACKETS]` and replace. These are facts only
you/counsel can supply:

| Placeholder | Meaning |
|---|---|
| `[ENTITY_NAME]` | The legal entity or person operating ShowShak (e.g. "ShowShak Technologies Pvt. Ltd." or "[Your Name], sole proprietor"). |
| `[ENTITY_TYPE]` | "a private limited company incorporated under the Companies Act, 2013" / "a sole proprietorship" / "an individual". |
| `[REGISTERED_ADDRESS]` | Full registered/operating address in India. |
| `[CITY]` | City whose courts have jurisdiction (e.g. "Bengaluru", "Mumbai"). |
| `[GRIEVANCE_OFFICER_NAME]` | Named, India-resident Grievance Officer (can be you during beta). |
| `[GRIEVANCE_EMAIL]` | Monitored grievance inbox, e.g. `grievance@showshak.app`. |
| `[COPYRIGHT_EMAIL]` | Monitored copyright/takedown inbox, e.g. `copyright@showshak.app`. |
| `[SUPPORT_EMAIL]` | General support/contact inbox. |
| `[EFFECTIVE_DATE]` | The date the policy version takes effect. |
| `[VERSION]` | Policy version label (e.g. `1.0-beta`). |
| `[WEBSITE_URL]` | The live URL (e.g. `https://piyush-120898.github.io/showshak-v2/`). |

> Use a real, monitored inbox for `[GRIEVANCE_EMAIL]` and `[COPYRIGHT_EMAIL]`
> from day one of the beta — an unreachable Grievance Officer is the single most
> common compliance failure (see the Delhi HC notices against Twitter/X).
