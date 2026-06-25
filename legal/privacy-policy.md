<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Privacy Policy

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> This Privacy Policy explains what personal data ShowShak collects, why, how we
> use and share it, and your rights under the **Digital Personal Data Protection
> Act, 2023 ("DPDP Act")**. ShowShak is operated by **[ENTITY_NAME]**
> ("**we**", "**us**"), the **Data Fiduciary**. You are a **Data Principal**.

---

## 1. Scope and key facts

- **India only, open beta.** ShowShak operates only in India during the beta. The
  website is publicly accessible; clip upload is limited to invited curators.
- **18+ only.** The beta is restricted to users aged 18 and over. We do not
  knowingly process the personal data of anyone under 18. (The DPDP Act requires
  verifiable parental consent to process a child's data; the beta does not offer
  this, so under-18s may not use ShowShak.)
- **Data stored in India.** Our database, authentication, and image storage run on
  Supabase infrastructure in the **Mumbai (India) region**. Video is processed by
  Mux (see Section 5).
- **Non-commercial beta.** We do **not** sell your personal data, and we do **not**
  run advertising or use your data for third-party ad targeting.

## 2. What personal data we collect

**(a) Information you give us**
- **Account & identity:** your email address and the sign-in method you use
  (Google, Apple, or email); your display name; your **username/handle**; and,
  optionally, a **profile photo (avatar)**, **bio**, and **gender**.
- **Onboarding preferences:** your **taste/genres**, your **region**, and the
  **streaming platforms you tell us you subscribe to** (used only to route
  "Watch It" to a service you already have — never shown on your profile).
- **Curator content:** if you are a curator, the **clips** you upload (video +
  audio), captions/pitch, the **titles** you link, vibe tags, and cover frame.
- **Attestations & complaints:** the **attestation** you accept at upload (that
  you hold the rights to your clip), and any **report, copyright complaint, or
  grievance** you submit (including the contact details in it).

**(b) Information generated as you use ShowShak**
- **Activity:** clips you **Fire** (like), curators you **follow**, clips you
  **save** into Stacks, clips you **view** (and approximate watch time), **shares**,
  and **"Watch It" taps** (which title/platform, and your region).
- **Watch history:** a recently-watched list to help you re-find clips.
- **Device/technical data:** standard information your browser/app sends, such as
  IP address, device/browser type, and timestamps, and cookies/local storage used
  to keep you signed in and remember preferences (e.g. mute, recent searches).

**(c) Guest data.** If you use ShowShak before signing up, some activity (e.g.
views, fires) may be recorded under an **anonymous identifier**. If you later sign
up, this may be associated with your account.

We do **not** intentionally collect special-category data, government IDs, or
payment information (there are no payments in the beta).

## 3. How the "hide the scoreboard" rule protects you

Some metrics are deliberately **private by database design**, not just hidden in
the app: a curator's total fires-received and "Watch It" taps, and any individual's
"fires given", are **never shown publicly** and are enforced by row-level security.
Public profiles show only followers and clip count. We treat your engagement as
private signal, not a public scoreboard.

## 4. Why we use your data, and our lawful basis

We process personal data to provide and improve the service. Under the DPDP Act we
rely on your **consent** and on **certain legitimate uses** permitted by the Act
(such as the purpose for which you voluntarily provided data). Specifically:

| Purpose | Examples |
|---|---|
| Provide the core service | Authenticate you; show the feed; play clips; run Fire/Save/Follow; route "Watch It" |
| Personalise (with your consent) | Tailor the feed to your taste/genres and activity |
| Curator features & integrity | Publish clips; record attestations; show your public curator profile |
| Safety, moderation & legal | Handle reports, copyright complaints, and grievances; enforce the Terms; keep records we must keep by law |
| Maintain & improve | Diagnose problems, measure performance/quality of video playback, prevent abuse |
| Communicate | Service messages and, only if you opt in, product updates |

We do **not** use your data for automated decisions that produce legal or similarly
significant effects on you.

## 5. Who processes data for us (sub-processors)

We share personal data only with service providers ("Data Processors") that help us
operate ShowShak, under contractual confidentiality and security obligations:

| Processor | Role | Notes |
|---|---|---|
| **Supabase** | Database, authentication, image storage, serverless functions | Hosted in the **Mumbai, India** region |
| **Mux** | Video upload, encoding, streaming, and playback quality analytics | Receives clip video + playback technical data |
| **Google / Apple** | Sign-in (OAuth), if you choose them | We receive basic profile info you authorise |
| **TMDB** | Show/movie titles and "where to watch" data | We send **title queries**, not your personal data; the browser never contacts TMDB directly |
| **jsDelivr (CDN)** | Serves software libraries to your browser | May receive your IP as part of standard web requests |

We do not sell personal data and do not share it with advertisers. We may disclose
data to courts, law-enforcement, or government authorities **where required by law**
or to protect rights, safety, and the integrity of the service.

## 6. International transfers

Core personal data is stored in **India** (Supabase Mumbai). Some processors (e.g.
Mux, the CDN, OAuth providers) may process limited data outside India. Where that
happens, we rely on the provider's contractual safeguards and process such transfers
consistent with the DPDP Act and any restrictions the Central Government notifies.

## 7. How long we keep data (retention)

- We keep your account and content while your account is active.
- When you **delete** your account, we hide it immediately and **permanently erase**
  personal data after a limited **restore window (about 30 days)**, after which it is
  removed, except for data we must retain.
- **Records we retain by law / for legal defensibility** (even after a clip or
  account is removed): **attestations** and the **moderation/grievance audit log**
  (who reported what, what we did, and when). These prove rights-holder
  responsibility and our compliant handling of complaints, and are kept only as long
  as necessary for those purposes.
- Routine backups may persist for a limited period before rotation.

## 8. Your rights (DPDP Act)

As a Data Principal you may:
- **Access** a summary of the personal data we process about you and how;
- **Correct, complete, or update** inaccurate or incomplete data;
- **Erase** your data (subject to records we must keep by law);
- **Withdraw consent** at any time (this does not affect prior lawful processing);
- **Nominate** another person to exercise your rights in case of death or incapacity;
  and
- **Grievance redressal** — raise a complaint with our Grievance Officer (Section 11)
  and, where applicable, escalate to the **Data Protection Board of India**.

To exercise any right, contact us at **[GRIEVANCE_EMAIL]**. Most controls (edit
profile, manage platforms, clear watch history, deactivate/delete account) are also
available in **Settings**.

## 9. Security

We use technical and organisational measures appropriate to a beta service,
including encryption in transit, access controls, and **row-level security** that
enforces who can read or write each kind of data at the database layer. No method of
transmission or storage is perfectly secure; we cannot guarantee absolute security.
If a personal-data breach occurs, we will act and notify as required by the DPDP Act
and applicable rules.

## 10. Children

ShowShak's beta is **for users 18 and older only** (Section 1). We do not knowingly
collect personal data from anyone under 18. If you believe a minor has provided us
data, contact **[GRIEVANCE_EMAIL]** and we will delete it.

## 11. Grievance Officer and contact

In accordance with the IT Rules 2021 and the DPDP Act, you may contact:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Email:** [GRIEVANCE_EMAIL]
- **Address:** [REGISTERED_ADDRESS], India

We **acknowledge complaints within 24 hours** and **resolve them within 15 days**.
General privacy questions: **[SUPPORT_EMAIL]**.

## 12. Changes to this Policy

We may update this Policy. We will post the new version with an updated effective
date and, for material changes, take reasonable steps to notify you and, where
required, seek fresh consent. Prior versions are retained and identifiable by
version label.

---

*ShowShak is an open beta operated in India. This document is a draft pending
review by qualified Indian legal counsel and is not legal advice. The DPDP Act,
2023 and DPDP Rules, 2025 (notified 13 November 2025) are being brought into force
in phases — substantive notice/consent/rights obligations and penalties commence
around May 2027 — and we will adjust this Policy as those obligations commence.*
