-- ═══════════════════════════════════════════════════════════════
-- seed_policy_versions.sql  (READY TO RUN — real legal/*.md bodies inlined)
-- SHOWSHAK — BETA CONSENT GATE: publish the real legal drafts
-- (.kiro/specs/beta-consent-gate — Task 3.2; Requirements 1, 8)
-- ───────────────────────────────────────────────────────────────
-- FOUNDER-RUN, IDEMPOTENT data seed. Apply migration 0031 FIRST (it widens
-- policy_versions.doc to allow 'curator' and creates the consents machinery).
-- Then paste this WHOLE file into the Supabase SQL editor and Run.
--
-- Bodies below are the VERBATIM contents of legal/terms-of-service.md,
-- legal/privacy-policy.md, and legal/curator-terms.md as of generation time.
-- They still contain [PLACEHOLDER] tokens (entity, emails, Grievance Officer,
-- VERSION, EFFECTIVE_DATE) — that is expected: showshak-legal.html keeps the
-- "counsel review required" banner up while bracketed tokens remain. To publish
-- final text later, fill the placeholders, then INSERT a NEW version row and
-- atomically repoint is_current (prior rows are never mutated).
--
-- IDEMPOTENT: each insert is guarded by `where not exists (doc, version)`, so
-- re-running inserts nothing once a (doc, version) pair is already published.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- GRANT READ ACCESS (fixes "Curator Terms unavailable")
-- ───────────────────────────────────────────────────────────────
-- 0029 enabled RLS + a world-read policy on policy_versions but never granted
-- the API roles table-level SELECT. An RLS policy only filters rows for a role
-- that ALREADY has the table privilege, so the browser's direct read
-- (ssCurrentPolicyVersions -> from('policy_versions').select(...)) was
-- permission-denied -> the consent gate + curator-terms bind resolved as
-- "unavailable". SELECT only (never insert/update) keeps the table read-only for
-- ordinary users; RLS still hides soft-deleted rows. Idempotent.
grant select on policy_versions to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- TERMS OF SERVICE  (doc='tos' ← legal/terms-of-service.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'tos', '1.0-beta', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Terms of Service

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> **Please read these Terms carefully.** They are a binding agreement between you
> and [ENTITY_NAME]. By creating an account, accessing, or using ShowShak you
> agree to these Terms. If you do not agree, do not use the service.

---

## 1. Who we are and what ShowShak is

1.1. ShowShak ("**ShowShak**", "**we**", "**us**", "**our**") is operated by
**[ENTITY_NAME]**, [ENTITY_TYPE], having its registered/operating address at
**[REGISTERED_ADDRESS]**, India.

1.2. ShowShak is a **streaming-discovery service**. Curators post short vertical
video clips recommending shows and movies; users watch the clips and, if
interested, tap **"Watch It"** to be directed to the third-party streaming
platform where the title is available. **ShowShak is not a streaming service,
is not a social-media network, and does not host, license, or provide the
underlying shows or movies.** We are a discovery layer that links out to
third-party platforms (e.g. Netflix, Prime Video, JioHotstar).

1.3. **Intermediary status.** ShowShak is an *intermediary* under §2(1)(w) of
the Information Technology Act, 2000. We store and make available content
uploaded by users (curators). We do not initiate the transmission, select the
receiver, or select or modify the information contained in a clip, except as
required to operate the service (e.g. transcoding, thumbnails).

## 2. Beta service — important

2.1. ShowShak is currently offered as an **open beta in India only**. The website
is publicly accessible to anyone with the link; **clip upload is limited to invited
curators**. Features may change, break, or be removed; data may be reset; and
availability is not guaranteed.

2.2. **The service is provided "as is" and "as available"** during the beta (see
Section 12).

2.3. **No commercial offering.** During the beta there is **no payment,
subscription, advertising, or monetisation**. We do not charge you and we do not
pay you.

2.4. We may end the beta, or any part of it, at any time.

## 3. Eligibility — you must be 18 or older

3.1. **You must be at least 18 years old to use ShowShak during the beta.** By
using ShowShak you represent that you are 18 or older. This age threshold reflects
the requirement under the Digital Personal Data Protection Act, 2023 for
verifiable parental consent before processing the personal data of a child
(a person under 18), which the beta does not support.

3.2. If we learn that a user is under 18, we may suspend or delete the account and
associated personal data.

3.3. You must have the legal capacity to enter into this agreement and must not be
barred from using the service under any applicable law.

## 4. Your account

4.1. You may sign in using a supported method (e.g. Google, Apple, or email). You
are responsible for the security of your account and for all activity under it.

4.2. The information you provide (such as your name, username/handle, and taste
preferences) must be accurate. You must not impersonate any person or entity or
choose a handle that infringes another's rights.

4.3. You may use the service as a **guest** before signing up. Guest activity may
be recorded under an anonymous identifier and, on sign-up, associated with your
account (see the Privacy Policy).

## 5. Curators, clips, and **your responsibility for content** (key terms)

5.1. **Curator-supplied content.** If you upload a clip ("**Your Content**"), you
— not ShowShak — are solely responsible for it, including the video, audio,
captions, and any title you reference.

5.2. **Attestation (required at upload).** Before any clip is published you must
affirmatively **attest** that:
  (a) you created the clip or have all rights, licences, consents, and permissions
      necessary to upload it and to grant the licence in Section 5.4;
  (b) the clip's video **and audio** do not infringe any third party's copyright,
      trademark, publicity, privacy, or other rights; and
  (c) the clip does not violate these Terms, the Community Guidelines, or any law.
ShowShak records this attestation (who, when, and the policy versions in force).
**No clip is published without a recorded attestation.**

5.3. **Indemnity.** You agree to indemnify, defend, and hold harmless ShowShak,
[ENTITY_NAME], and its personnel from and against any claim, demand, loss,
liability, cost, or expense (including reasonable legal fees) arising out of or
related to Your Content, your use of the service, or your breach of these Terms.
This Section survives termination.

5.4. **Licence you grant us.** You grant ShowShak a worldwide, non-exclusive,
royalty-free, sub-licensable licence to host, store, reproduce, transcode, adapt
(for formatting/thumbnails), publish, and display Your Content **solely to
operate, provide, and improve the service**. This licence ends when you delete
Your Content or your account, except (i) for copies retained in routine backups
for a limited period, and (ii) where retention is required by law or to resolve
disputes / enforce our agreements (e.g. attestation and moderation records — see
the Copyright Policy and Privacy Policy).

5.5. **No endorsement; neutral host.** ShowShak does not pre-screen or endorse
Your Content. Recommendations and opinions in clips are the curator's own.

5.6. **Fair dealing.** Curators are expected to use only material they are
entitled to use. Nothing in these Terms grants you any right in any show, movie,
or other work referenced on ShowShak; all such rights remain with their owners.

## 6. Acceptable use

6.1. You agree to follow the **Community Guidelines** (incorporated into these
Terms by reference). In particular, and consistent with Rule 3(1)(b) of the IT
Rules 2021, you must not upload, share, or display content that:
  (a) belongs to another person and to which you do not hold rights;
  (b) is defamatory, obscene, pornographic, paedophilic, or invasive of privacy,
      including bodily privacy;
  (c) is harmful to a child;
  (d) infringes any patent, trademark, copyright, or other proprietary right;
  (e) violates any law in force, is deceptive or misleading, or impersonates
      another person;
  (f) threatens the unity, integrity, defence, security, or sovereignty of India,
      friendly relations with foreign States, or public order, or incites any
      cognisable offence;
  (g) contains software viruses or malicious code; or
  (h) is patently false or misinformation, or knowingly communicates false
      information.

6.2. You must not abuse, reverse-engineer, scrape, overload, or interfere with the
service, or attempt to access data you are not authorised to access.

6.3. You must not misuse the "Watch It", report, or grievance features (e.g.
filing false takedown notices).

## 7. Content moderation, takedown, and termination

7.1. **We may remove content and may suspend or terminate accounts** that violate
these Terms, the Community Guidelines, or applicable law, or in response to a valid
legal request.

7.2. **Copyright complaints** are handled under our **Copyright Policy**, which
follows Rule 75 of the Copyright Rules, 2013 and the IT Act, 2000. A clip subject
to a valid complaint is **disabled (made not publicly visible) within 36 hours**
and may be restored as described there.

7.3. **Repeat infringers.** We will, in appropriate circumstances, suspend or
terminate the accounts of users who repeatedly infringe others' rights, as
described in the Community Guidelines.

7.4. **Grievances.** If you have a complaint about content or about our handling
of your data, contact our Grievance Officer (Section 13). We acknowledge
grievances within **24 hours** and aim to resolve them within **15 days**, as
required by the IT Rules 2021.

## 8. The "Watch It" feature and third-party platforms

8.1. "Watch It" links to third-party streaming platforms. Those platforms are
operated by others, under their own terms and privacy policies. **We do not
control them, do not guarantee that any title is available, and are not
responsible for them.** Availability data is sourced from third parties (e.g.
TMDB) and the curator's declaration and may be inaccurate or out of date.

8.2. We have no affiliation with, sponsorship by, or endorsement from any
streaming platform unless expressly stated.

## 9. Intellectual property in the service

9.1. The ShowShak name, logo, design, software, and all materials we provide
(excluding Your Content and third-party materials) are owned by [ENTITY_NAME] or
our licensors and are protected by law. We grant you a limited, personal,
non-transferable, revocable licence to use the service for its intended purpose.

9.2. You must not use our marks without our prior written permission.

## 10. Your data

10.1. Our collection and use of personal data is described in the **Privacy
Policy**, which forms part of these Terms.

## 11. Suspension, termination, and your right to leave

11.1. You may stop using ShowShak and delete your account at any time from
Settings. On deletion we handle your data as described in the Privacy Policy
(including a limited retention/restore window and records we must keep by law).

11.2. We may suspend or terminate your access at any time for breach of these
Terms, to comply with law, or to protect the service or other users. We will give
notice where reasonably practicable.

11.3. Sections that by their nature should survive termination (including 5.3, 9,
12, 13, 14, 15) survive.

## 12. Disclaimers (beta)

12.1. **The service is provided "as is" and "as available", without warranties of
any kind**, whether express or implied, including merchantability, fitness for a
particular purpose, accuracy, and non-infringement, to the maximum extent
permitted by law.

12.2. We do not warrant that the service will be uninterrupted, secure, error-free,
or that content (including availability information) is accurate.

## 13. Grievance Officer (IT Rules 2021)

In accordance with Rule 3(2) of the IT Rules 2021, the Grievance Officer for
ShowShak is:

- **Name:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL]
- **Address:** [REGISTERED_ADDRESS], India

The Grievance Officer **acknowledges every complaint within 24 hours** and
**resolves it within 15 days** of receipt. For copyright complaints, also see the
Copyright Policy.

## 14. Limitation of liability

14.1. To the maximum extent permitted by law, and given that the service is a free
beta, [ENTITY_NAME] and its personnel will not be liable for any indirect,
incidental, special, consequential, or punitive damages, or any loss of data,
profits, or goodwill, arising from your use of (or inability to use) the service.

14.2. To the maximum extent permitted by law, our total aggregate liability arising
out of or relating to the service will not exceed one thousand Indian Rupees
(₹1,000) — reflecting that the beta is provided free of charge. Nothing in these
Terms excludes liability that cannot be excluded under applicable law.

## 15. Governing law and disputes

15.1. These Terms are governed by the laws of India.

15.2. Subject to applicable law, the courts at **[CITY]**, India will have
exclusive jurisdiction over any dispute arising out of or relating to these Terms
or the service.

## 16. Changes to these Terms

16.1. We may update these Terms. We will post the updated version with a new
effective date and, for material changes, take reasonable steps to notify you.
Continued use after the effective date means you accept the updated Terms. Prior
versions are retained and remain identifiable by version label.

## 17. Contact

Questions about these Terms: **[SUPPORT_EMAIL]**.
Grievances: **[GRIEVANCE_EMAIL]** (Section 13).
Copyright: **[COPYRIGHT_EMAIL]** (see the Copyright Policy).

---

*ShowShak is an open beta operated in India. This document is a draft pending
review by qualified Indian legal counsel and is not legal advice.*
$SS$, true
where not exists (select 1 from policy_versions where doc='tos' and version='1.0-beta');

-- ───────────────────────────────────────────────────────────────
-- PRIVACY POLICY  (doc='privacy' ← legal/privacy-policy.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'privacy', '1.0-beta', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
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
$SS$, true
where not exists (select 1 from policy_versions where doc='privacy' and version='1.0-beta');

-- ───────────────────────────────────────────────────────────────
-- CURATOR TERMS  (doc='curator' ← legal/curator-terms.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'curator', '1.0-beta', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Curator Terms

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> These Curator Terms are a binding agreement between you (the "**curator**") and
> **[ENTITY_NAME]**, the operator of ShowShak. They set out what rights you keep
> in the clips you post, the licence you grant us to run them on the service, and
> the responsibilities you accept as a curator. By accepting these Curator Terms
> and activating the curator role, you agree to them. They form part of, and are
> enforced under, the **Terms of Service**, and they incorporate the **Community
> Guidelines** and the **Copyright Policy** by reference.
>
> **One-time, relationship-level acceptance.** You accept these Curator Terms
> **once**, when you become a curator. This is separate from — and complements —
> the per-upload **attestation** you make **every time you publish a clip** (see
> the Terms of Service, Section 5). Accepting these Terms does not replace that
> per-publish attestation; both apply.

---

## 1. Who we are and what ShowShak is

1.1. ShowShak ("**ShowShak**", "**we**", "**us**", "**our**") is operated by
**[ENTITY_NAME]**, [ENTITY_TYPE], having its registered/operating address at
**[REGISTERED_ADDRESS]**, India.

1.2. ShowShak is a **streaming-discovery service**. Curators post short vertical
video clips recommending shows and movies; viewers watch the clips and, if
interested, tap **"Watch It"** to be directed to the third-party streaming
platform where the title is available.

1.3. **Intermediary status.** ShowShak is an *intermediary* under §2(1)(w) of the
Information Technology Act, 2000, and maintains safe harbour under **§79 of the IT
Act** and the **IT Rules 2021** by observing due diligence and acting on valid
notices and court/government orders. Curators upload their own clips; we do not
initiate the transmission, select the receiver, or select or modify a clip, except
as required to operate the service (e.g. transcoding, thumbnails).

## 2. You keep ownership of your clips

2.1. **Ownership retained.** You **retain ownership** of the clips you post to
ShowShak ("**Your Clips**"), including the copyright in any original material you
created. Nothing in these Terms transfers ownership of Your Clips to ShowShak.

2.2. These Terms grant us only the **licence** described in Section 3 — a
permission to use Your Clips to operate the service. You remain free to use Your
Clips elsewhere, subject to the rights of any third parties whose material they
contain.

## 3. The licence you grant ShowShak (essential)

3.1. **Licence grant.** For each clip you post, and for as long as that clip is on
the platform, you grant ShowShak a **non-exclusive, worldwide, royalty-free,
sublicensable** licence — extending to ShowShak and to its infrastructure,
content-delivery (CDN), and video providers (for example, **Mux**) — to **host,
store, reproduce, transcode, create thumbnails and previews of, display,
distribute, and promote** the clip on and through the service.

3.2. **Why this licence is needed.** This licence is what lets ShowShak and the
technical providers that power it actually run the service: storing your upload,
converting it into streamable formats, generating thumbnails and previews,
delivering it to viewers worldwide through a CDN, and showcasing it within the
service. The licence is **non-exclusive** (you keep your own rights — see Section
2), **royalty-free** (we do not pay you and you do not pay us during the beta —
ShowShak is non-commercial today), and **sublicensable** only so far as necessary
for those providers to perform these functions on our behalf.

3.3. **Duration and end of licence.** The licence runs for **as long as the clip
is on the platform**. When the clip is **removed** — by you, or by us under the
Terms of Service, the Community Guidelines, or the Copyright Policy — the licence
**ends**, **except** for (i) copies retained in routine **backups** for a limited
period, and (ii) copies retained where required by law or to resolve disputes or
enforce our agreements (a reasonable **legal-retention tail**, including
attestation and moderation records).

## 4. ShowShak claims no ownership — we are a neutral host

4.1. **No ownership claim.** ShowShak **claims no ownership** of Your Clips. The
licence in Section 3 does not make us the owner of anything you post.

4.2. **Neutral host and showcase.** ShowShak is a **neutral host and showcase** for
curator clips. We do not pre-screen or endorse Your Clips; recommendations and
opinions in a clip are the curator's own.

4.3. **We do not host the underlying titles.** ShowShak **does not host, license, or
provide the underlying shows or movies**. We are a discovery layer. The **"Watch
It"** action **links out to third-party streaming platforms** (e.g. Netflix, Prime
Video, JioHotstar), which are operated by others under their own terms. Title and
availability data come from third parties (e.g. TMDB) and from the curator's
declaration, and may be inaccurate or out of date. Trademarks and titles belong to
their respective owners; their appearance on ShowShak does not imply affiliation or
endorsement.

## 5. Your rights warranty

5.1. **You represent and warrant** that, for each clip you post, you **created the
clip or hold all necessary rights, licences, and permissions** to it and to
**everything in it** — including the **video**, the **audio and music**, and any
**third-party material** — and to grant the licence in Section 3.

5.2. You further represent and warrant that the clip **does not infringe** any
third party's copyright, trademark, publicity, privacy, or other rights, and does
not otherwise violate these Terms, the Community Guidelines, the Copyright Policy,
or any applicable law.

## 6. Your responsibility and indemnity

6.1. **Sole responsibility.** You — not ShowShak — are **solely responsible** for
Your Clips, including the video, audio, captions, and any title you reference.

6.2. **Indemnity.** You agree to **indemnify, defend, and hold harmless** ShowShak,
[ENTITY_NAME], and its personnel from and against any claim, demand, loss,
liability, cost, or expense (including reasonable legal fees) **arising out of or
related to Your Clips**, your use of the service, or your breach of these Terms.
This Section survives termination of your account and of these Terms.

## 7. Rules you agree to follow

7.1. **Community Guidelines and Copyright Policy.** You agree to the **Community
Guidelines** and the **Copyright Policy**, both of which are incorporated into these
Terms by reference.

7.2. **No infringing content; no unlicensed music or audio.** You will **not** post
infringing content, and you will **not** add **music or audio you are not entitled
to use**. During the beta, ShowShak does not provide a catalogue of copyrighted
music to add to clips, and you must not add any you are not licensed to use. This
protects every curator's safe-harbour position.

7.3. **Repeat infringers.** ShowShak maintains a **repeat-infringer policy**.
Curators whose clips are repeatedly the subject of substantiated rights complaints
may be **suspended or terminated**, as described in the Community Guidelines and the
Copyright Policy.

## 8. Takedown, grievances, and how complaints are handled

8.1. **Takedown.** Copyright complaints about a clip are handled under our
**Copyright Policy**, which follows **Rule 75 of the Copyright Rules, 2013** and
the IT Act, 2000: on a valid, good-faith complaint a clip is **disabled within 36
hours** and may be **restored** if no court order is produced within **21 days**, as
described there. A curator whose clip is disabled may respond as set out in the
Copyright Policy.

8.2. **Grievances.** For complaints about content or about our handling of your
data, contact our **Grievance Officer**, who **acknowledges every complaint within
24 hours** and **resolves it within 15 days** of receipt, as required by Rule 3(2)
of the IT Rules 2021:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL] (copyright matters: **[COPYRIGHT_EMAIL]**)
- **Address:** [REGISTERED_ADDRESS], India

8.3. The in-app takedown form is available at **[WEBSITE_URL]showshak-dmca.html**.

## 9. Suspension and termination

9.1. We may **remove or disable** Your Clips and may **suspend or terminate** your
curator role or account for breach of these Terms, the Community Guidelines, the
Copyright Policy, or applicable law, or in response to a valid legal request. We
will give notice where reasonably practicable.

9.2. On removal of a clip or termination of your account, the licence in Section 3
ends as described in Section 3.3 (subject to backups and the legal-retention tail).
Sections that by their nature should survive (including 2, 5, 6, and 8) survive
termination.

## 10. Changes to these Terms

10.1. We may update these Curator Terms. We will post the updated version with a new
effective date, and your continued curation after the effective date means you
accept the updated Terms. Prior versions are retained and remain identifiable by
version label.

## 11. Contact

Questions about these Curator Terms: **[SUPPORT_EMAIL]**.
Grievances: **[GRIEVANCE_EMAIL]** (Section 8).
Copyright: **[COPYRIGHT_EMAIL]** (see the Copyright Policy).

---

*ShowShak is an open beta operated in India. This document is a draft pending
review by qualified Indian legal counsel and is not legal advice.*
$SS$, true
where not exists (select 1 from policy_versions where doc='curator' and version='1.0-beta');

-- ── Re-seed recipe for counsel-approved FINAL text (per doc) ──
--   insert into policy_versions (doc, version, effective_date, body, is_current)
--   select '<doc>', '<new-version>', date '<new-effective-date>', $SS$<final body>$SS$, true
--   where not exists (select 1 from policy_versions where doc='<doc>' and version='<new-version>');
--   update policy_versions set is_current = false
--    where doc = '<doc>' and version <> '<new-version>' and is_current;
