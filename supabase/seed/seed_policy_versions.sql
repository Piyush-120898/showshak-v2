-- ═══════════════════════════════════════════════════════════════
-- seed_policy_versions.sql  (GENERATED — do not hand-edit; see data/_gen_policy_seed.js)
-- SHOWSHAK — BETA CONSENT GATE: publish the (expanded) legal drafts into
-- policy_versions so showshak-legal.html + the consent gate render the real text.
-- ───────────────────────────────────────────────────────────────
-- FOUNDER-RUN, IDEMPOTENT data seed. Apply migration 0031 FIRST (it widens
-- policy_versions.doc to allow 'curator' and creates the consents machinery).
-- Then paste this WHOLE file into the Supabase SQL editor and Run.
--
-- Bodies below are the VERBATIM contents of the legal/*.md drafts at generation
-- time (version '1.1-draft'). They still contain [PLACEHOLDER] tokens (entity,
-- address, emails, Grievance Officer, VERSION, EFFECTIVE_DATE, etc.) — that is
-- expected: showshak-legal.html keeps the "counsel review required" banner up
-- while bracketed tokens remain. To publish FINAL text: fill the placeholders +
-- counsel-approve, bump VERSION in data/_gen_policy_seed.js, re-run it, and apply.
--
-- IDEMPOTENT: each insert is guarded by NOT EXISTS (doc, version); the is_current
-- repoint at the end makes ONLY this version current per doc (prior rows kept).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- GRANT READ ACCESS (fixes "policies unavailable" — RLS needs table SELECT too)
-- ───────────────────────────────────────────────────────────────
grant select on policy_versions to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- TERMS OF SERVICE  (doc='tos' ← legal/terms-of-service.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'tos', '1.1-draft', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Terms of Service

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> **Please read these Terms carefully.** They are a binding agreement between you
> and **[ENTITY_NAME]** (the operator of ShowShak). By creating an account, or by
> accessing or using ShowShak, you agree to these Terms and to our **Privacy
> Policy**, **Community Guidelines**, and **Copyright Policy**, and — if you become
> a curator — our **Curator Terms**. If you do not agree, do not use the service.

> **At a glance (this summary is not a substitute for the full Terms):**
> - ShowShak is a **streaming-discovery** layer, **not** a streaming service and
>   **not** social media. We link out to platforms like Netflix and Prime Video.
> - You must be **18 or older** to use the beta.
> - Curators are **responsible for the clips they upload** and confirm they have
>   the rights to them. ShowShak is a **neutral host** (intermediary).
> - The service is a **free, "as-is" beta**; features may change or break.
> - Copyright complaints are handled under our **Copyright Policy** (clips disabled
>   within 36 hours of a valid notice).
> - Section 17 governs **disputes** (informal resolution first; Indian courts).

---

## 1. Who we are and what ShowShak is

1.1. ShowShak ("**ShowShak**", "**we**", "**us**", "**our**") is operated by
**[ENTITY_NAME]**, [ENTITY_TYPE], having its registered/operating address at
**[REGISTERED_ADDRESS]**, India.

1.2. ShowShak is a **streaming-discovery service**. Curators post short vertical
video clips recommending shows and movies; users watch the clips and, if
interested, tap **"Watch It"** to be directed to the third-party streaming platform
where the title is available. **ShowShak is not a streaming service, is not a
social-media network, and does not host, license, or provide the underlying shows
or movies.** We are a discovery layer that links out to third-party platforms (for
example, Netflix, Prime Video, JioHotstar).

1.3. **Intermediary status.** ShowShak is an *intermediary* under §2(1)(w) of the
Information Technology Act, 2000, and maintains safe harbour under **§79 of the IT
Act** and the **IT Rules 2021** by observing due diligence and acting on valid
notices and court/government orders. We store and make available clips uploaded by
curators. We do not initiate the transmission, select the receiver of a
transmission, or select or modify the information contained in a clip, except as
required to operate the service (for example, transcoding and generating
thumbnails).

## 2. Acceptance and how these Terms work

2.1. **Acceptance.** By creating an account or using ShowShak, you accept these
Terms and consent to contract with us electronically. If you accept on behalf of an
organisation, you confirm you have authority to bind it.

2.2. **Documents that form part of these Terms.** These Terms incorporate, by
reference, our **Privacy Policy**, **Community Guidelines**, and **Copyright
Policy**, and — for curators — the **Curator Terms**. Together these are the
"Agreement".

2.3. **Order of precedence.** If there is a direct conflict between documents, the
following order applies for the conflicting point only: (a) the Copyright Policy for
takedown mechanics; (b) the Curator Terms for curator content and licensing; (c)
the Privacy Policy for personal-data matters; and (d) these Terms for everything
else.

2.4. **Versions and changes.** We may update the Agreement (Section 19). The current
version and effective date appear at the top of each document, and prior versions
are retained and identifiable by version label.

## 3. Beta service — important

3.1. ShowShak is currently offered as an **open beta in India only**. The website is
publicly accessible to anyone with the link; **clip upload is limited to invited
curators**. Features may change, break, or be removed; data may be reset; and
availability is not guaranteed.

3.2. **The service is provided "as is" and "as available"** during the beta (see
Section 13).

3.3. **No commercial offering.** During the beta there is **no payment,
subscription, advertising, or monetisation**. We do not charge you and we do not pay
you. Any future change would be made on updated terms and, where required, with your
consent.

3.4. We may end the beta, or any part of it, at any time.

## 4. Eligibility — you must be 18 or older

4.1. **You must be at least 18 years old to use ShowShak during the beta.** By using
ShowShak you represent that you are 18 or older. This threshold reflects the
requirement under the DPDP Act, 2023 for verifiable parental consent before
processing the personal data of a person under 18, which the beta does not support.

4.2. If we learn that a user is under 18, we may suspend or delete the account and
associated personal data.

4.3. You must have the legal capacity to enter into this Agreement and must not be
barred from using the service under any applicable law, and you must not be a person
with whom we are legally prohibited from dealing.

## 5. Your account

5.1. **Registration.** You may sign in using a supported method (for example,
Google, Apple, or email). You may use ShowShak as a **guest** before signing up;
guest activity may be recorded under an anonymous identifier and, on sign-up,
associated with your account (see the Privacy Policy).

5.2. **Accuracy.** The information you provide (such as your name, username/handle,
and taste preferences) must be accurate and kept current. You must not impersonate
any person or entity, or choose a handle that infringes another's rights or is
misleading.

5.3. **Account security.** You are responsible for the security of your account and
for all activity under it. Keep your credentials confidential, do not share them,
and notify us promptly of any unauthorised use. An account is for one person.

5.4. **Consent and acceptances.** Creating an account requires accepting these Terms
and the Privacy Policy and confirming you are 18+. Becoming a curator requires a
one-time acceptance of the Curator Terms. We record these acceptances with the
version in force.

## 6. Curators, clips, and your responsibility for content (key terms)

6.1. **Curator-supplied content.** If you upload a clip ("**Your Content**"), you —
not ShowShak — are solely responsible for it, including the video, audio, captions,
and any title you reference.

6.2. **One-time acceptance; per-clip record.** When you become a curator you accept
the **Curator Terms once**; in them you represent and warrant that, **for each clip
you post**, you hold all necessary rights to the video and audio and accept
responsibility and indemnity. So that this responsibility is provable per upload,
ShowShak **records an attestation for each published clip** (who published it, when,
and the policy versions in force). **No clip is published without a recorded
attestation.** Posting a clip confirms the rights warranty in the Curator Terms
applies to that clip.

6.3. **Indemnity.** You agree to indemnify, defend, and hold harmless ShowShak,
[ENTITY_NAME], and its personnel from and against any claim, demand, loss,
liability, cost, or expense (including reasonable legal fees) arising out of or
related to Your Content, your use of the service, or your breach of the Agreement.
This Section survives termination.

6.4. **Licence you grant us.** You grant ShowShak a worldwide, non-exclusive,
royalty-free, sublicensable licence to host, store, reproduce, transcode, adapt (for
formatting, thumbnails, and previews), publish, display, and distribute Your Content
**on and through the service**, and to its infrastructure, content-delivery, and
video providers (for example, Mux) so they can perform these functions on our
behalf. This licence exists only to operate, provide, and improve the service. It
ends when you delete Your Content or your account, except (i) for copies retained in
routine backups for a limited period, and (ii) where retention is required by law or
to resolve disputes or enforce the Agreement (for example, attestation and
moderation records). The full curator licence terms are in the Curator Terms.

6.5. **No endorsement; neutral host.** ShowShak does not pre-screen or endorse Your
Content. Recommendations and opinions in clips are the curator's own.

6.6. **Fair dealing.** Curators are expected to use only material they are entitled
to use. Nothing in the Agreement grants you any right in any show, movie, or other
work referenced on ShowShak; all such rights remain with their owners.

## 7. Acceptable use

7.1. **Community Guidelines.** You agree to follow the **Community Guidelines**,
incorporated by reference, which reflect the due-diligence content rules in Rule
3(1)(b) of the IT Rules 2021. In particular, you must not upload, share, or display
content that:
  (a) belongs to another person and to which you do not hold rights;
  (b) is defamatory, obscene, pornographic, paedophilic, or invasive of privacy,
      including bodily privacy, or is insulting/harassing on the basis of gender or
      racially/ethnically objectionable;
  (c) is harmful to a child;
  (d) infringes any patent, trademark, copyright, or other proprietary right;
  (e) violates any law in force, is deceptive or misleading, or impersonates another
      person;
  (f) threatens the unity, integrity, defence, security, or sovereignty of India,
      friendly relations with foreign States, or public order, or incites any
      cognisable offence;
  (g) contains software viruses or malicious code; or
  (h) is patently false or misinformation, or knowingly communicates false
      information.

7.2. **Code of conduct.** You must not harass, stalk, threaten, or abuse others;
distribute spam or fake engagement; manipulate fires, views, or follows; or collect
others' personal data without authorisation.

7.3. **Prohibited technical measures.** You must not scrape, crawl, reverse-engineer,
decompile, frame, mirror, or create derivative works from the service except as we
expressly permit; access the service by automated means except via tools we provide;
circumvent security, rate-limiting, or access controls; remove proprietary notices;
submit malicious code; or overload, interfere with, or damage the service.

7.4. **No misuse of features.** You must not misuse the "Watch It", report, or
grievance features — for example, by filing false takedown notices or
counter-notices, or vexatious or frivolous complaints.

## 8. Content moderation, takedown, and repeat infringers

8.1. **We may remove content and may suspend or terminate accounts** that violate the
Agreement or applicable law, or in response to a valid legal request. We may, but are
not obliged to, monitor content and conduct.

8.2. **Copyright complaints** are handled under our **Copyright Policy**, which
follows Rule 75 of the Copyright Rules, 2013 and the IT Act, 2000. A clip subject to a
valid complaint is **disabled (made not publicly visible) within 36 hours** and may
be restored as described there.

8.3. **Repeat infringers.** We will, in appropriate circumstances, suspend or
terminate the accounts of users who repeatedly infringe others' rights, as described
in the Community Guidelines and the Copyright Policy.

8.4. **Court orders / government notifications.** We act on a binding court order or
government notification under the IT Act, consistent with *Shreya Singhal v. Union of
India* (2015).

8.5. **Grievances.** If you have a complaint about content or about our handling of
your data, contact our Grievance Officer (Section 16). We acknowledge grievances
within **24 hours** and aim to resolve them within **15 days**, as required by the IT
Rules 2021.

## 9. The "Watch It" feature and third-party platforms

9.1. "Watch It" links to third-party streaming platforms operated by others under
their own terms and privacy policies. **We do not control them, do not guarantee that
any title is available, and are not responsible for them.** Availability data is
sourced from third parties (for example, TMDB) and the curator's declaration, and may
be inaccurate or out of date.

9.2. We have no affiliation with, sponsorship by, or endorsement from any streaming
platform unless expressly stated. Trademarks and titles belong to their respective
owners; their appearance on ShowShak does not imply affiliation or endorsement.

## 10. Intellectual property in the service; feedback

10.1. The ShowShak name, logo, design, software, and all materials we provide
(excluding Your Content and third-party materials) are owned by [ENTITY_NAME] or our
licensors and are protected by law. We grant you a limited, personal,
non-transferable, revocable licence to use the service for its intended purpose.

10.2. You must not use our marks without our prior written permission.

10.3. **Feedback.** If you send us suggestions or feedback, you grant us a perpetual,
irrevocable, royalty-free licence to use it without restriction or compensation to
you.

## 11. Your data

11.1. Our collection and use of personal data is described in the **Privacy Policy**,
which forms part of the Agreement. In short: we do not sell your personal data, the
beta is non-commercial, and any monetisation that uses personal data would require an
updated Policy and, where the law requires, fresh consent.

## 12. Suspension, termination, and your right to leave

12.1. You may stop using ShowShak and delete your account at any time from Settings.
On deletion we handle your data as described in the Privacy Policy (including a
limited restore window and records we must keep by law).

12.2. We may suspend or terminate your access at any time for breach of the
Agreement, to comply with law, or to protect the service or other users. We will give
notice where reasonably practicable; for serious breaches we may act immediately.

12.3. **Survival.** Sections that by their nature should survive termination
(including 6.3, 6.6, 10, 11, 13, 14, 15, 16, 17, and 18) survive.

## 13. Disclaimers (beta)

13.1. **The service is provided "as is" and "as available", without warranties of any
kind**, whether express or implied, including merchantability, fitness for a
particular purpose, accuracy, title, and non-infringement, to the maximum extent
permitted by law.

13.2. We do not warrant that the service will be uninterrupted, secure, error-free,
or available in your location, or that content (including availability information) is
accurate, or that any specific content will be hosted or removed.

## 14. Limitation of liability

14.1. To the maximum extent permitted by law, and given that the service is a free
beta, [ENTITY_NAME] and its personnel will not be liable for any indirect,
incidental, special, consequential, punitive, or exemplary damages, or any loss of
data, profits, goodwill, or business, arising from your use of (or inability to use)
the service.

14.2. To the maximum extent permitted by law, our total aggregate liability arising
out of or relating to the service will not exceed one thousand Indian Rupees (₹1,000),
reflecting that the beta is provided free of charge.

14.3. Nothing in these Terms excludes or limits liability that cannot be excluded or
limited under applicable law.

## 15. Indemnity

15.1. You agree to indemnify, defend, and hold harmless ShowShak, [ENTITY_NAME], and
its personnel from and against any third-party claim, demand, loss, liability, cost,
or expense (including reasonable legal fees) arising out of or related to: (a) Your
Content; (b) your use of the service; or (c) your breach of the Agreement or of any
law or third-party right. This Section survives termination.

## 16. Grievance Officer (IT Rules 2021)

In accordance with Rule 3(2) of the IT Rules 2021, the Grievance Officer for ShowShak
is:

- **Name:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL]
- **Address:** [REGISTERED_ADDRESS], India

The Grievance Officer **acknowledges every complaint within 24 hours** and **resolves
it within 15 days** of receipt. For copyright complaints, also see the Copyright
Policy.

## 17. Governing law and disputes

17.1. **Governing law.** These Terms are governed by the laws of India.

17.2. **Informal resolution first.** Before starting any formal proceeding, you agree
to contact us at **[GRIEVANCE_EMAIL]** with a description of the dispute and to try in
good faith to resolve it with us for at least **30 days**. Most concerns can be
resolved this way.

17.3. **Jurisdiction.** Subject to applicable law, the courts at **[CITY]**, India will
have exclusive jurisdiction over any dispute arising out of or relating to these Terms
or the service. *(If counsel later recommends an arbitration clause for India, it
will be added here as a separate, clearly-flagged provision.)*

## 18. General provisions

18.1. **Severability.** If any provision of the Agreement is held invalid or
unenforceable, that provision will be limited or severed to the minimum extent
necessary, and the remaining provisions remain in full force.

18.2. **Entire agreement.** The Agreement is the entire understanding between you and
us about the service and supersedes prior understandings on its subject matter.

18.3. **Assignment.** You may not assign or transfer the Agreement or your rights under
it without our prior written consent; any attempt to do so is void. We may assign the
Agreement (for example, to a successor entity in connection with a reorganisation,
financing, or sale of assets) on notice to you.

18.4. **No waiver.** Our failure to enforce any provision is not a waiver of our right
to do so later.

18.5. **Force majeure.** We are not liable for any delay or failure caused by events
beyond our reasonable control (for example, natural disasters, epidemics, war, civil
unrest, government action, or failures of utilities or telecommunications).

18.6. **Relationship.** The Agreement does not create any agency, partnership, joint
venture, or employment relationship between you and us.

18.7. **Notices.** We may give notices to you in-app or by email to the address on
your account; you must send legal notices to us at **[GRIEVANCE_EMAIL]** or our
registered address (Section 1.1).

18.8. **Language.** The English version of the Agreement controls; any translation is
for convenience only.

## 19. Changes to these Terms

19.1. We may update these Terms. We will post the updated version with a new effective
date and, for material changes, take reasonable steps to notify you. Continued use
after the effective date means you accept the updated Terms. Prior versions are
retained and remain identifiable by version label.

## 20. Contact

Questions about these Terms: **[SUPPORT_EMAIL]**.
Grievances: **[GRIEVANCE_EMAIL]** (Section 16).
Copyright: **[COPYRIGHT_EMAIL]** (see the Copyright Policy).

---

*ShowShak is an open beta operated in India. This document is a draft pending review
by qualified Indian legal counsel and is not legal advice.*
$SS$, true
where not exists (select 1 from policy_versions where doc='tos' and version='1.1-draft');

-- ───────────────────────────────────────────────────────────────
-- PRIVACY POLICY  (doc='privacy' ← legal/privacy-policy.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'privacy', '1.1-draft', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Privacy Policy

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> This Privacy Policy explains what personal data ShowShak collects, why, how we
> use it, who we share it with, how long we keep it, how we protect it, and the
> rights you have under the **Digital Personal Data Protection Act, 2023 ("DPDP
> Act")** and the **DPDP Rules, 2025**. ShowShak is operated by **[ENTITY_NAME]**
> ("**ShowShak**", "**we**", "**us**", "**our**"), which is the **Data Fiduciary**
> for the personal data described here. If you use ShowShak, you are a **Data
> Principal**. Please read this Policy together with our **Terms of Service**,
> **Curator Terms**, **Community Guidelines**, and **Copyright Policy**, which it
> forms part of.
>
> **The short version.** We collect only what we need to run a streaming-discovery
> service. We do **not sell your personal data**. During the beta we do **not** run
> advertising and do **not** use your data for third-party ad targeting. The only
> data we ever use to build market insights is **aggregated and de-identified** so
> that it does not identify you (Section 10). You can access, correct, and delete
> your data and withdraw consent at any time (Section 12).

---

## 1. Scope, key facts, and how to read this Policy

1.1. **Who this Policy applies to.** This Policy applies to personal data we
process about (a) visitors and registered users of the ShowShak website and app,
(b) curators who upload clips, and (c) people who contact us or submit a report,
copyright complaint, or grievance.

1.2. **India only, open beta.** ShowShak operates only in India during the beta.
The website is publicly accessible to anyone with the link; **clip upload is
limited to invited curators**. The DPDP Act applies to the processing of digital
personal data within India and to processing outside India that is connected with
offering goods or services to people in India.

1.3. **18+ only.** The beta is restricted to users aged 18 and over. We do not
knowingly process the personal data of anyone under 18. The DPDP Act requires
**verifiable consent of a parent or lawful guardian** before processing a child's
data and prohibits tracking, behavioural monitoring, and targeted advertising
directed at children; because the beta does not offer verifiable parental consent,
under-18s may not use ShowShak (see Section 14).

1.4. **Data stored in India.** Our database, authentication, and image storage run
on Supabase infrastructure in the **Mumbai (India) region**. Video is processed by
Mux; some processors operate outside India (see Sections 9 and 11).

1.5. **Non-commercial beta.** We do **not** sell your personal data, and during the
beta we do **not** run advertising or use your personal data for third-party ad
targeting. Any future change to this would require an updated Policy, a new policy
version, and — where the law requires — your fresh consent (Sections 10, 11, 17).

1.6. **Definitions.** To keep this Policy readable we use a few defined terms:
  - **Personal data** — any data about an individual who is identifiable by or in
    relation to such data.
  - **Processing** — any operation on personal data (collection, storage, use,
    sharing, erasure, and so on).
  - **Data Fiduciary** — the person who determines the purpose and means of
    processing (that is us).
  - **Data Principal** — the individual the personal data is about (that is you).
  - **Data Processor** — a person who processes personal data on our behalf and on
    our instructions (our service providers — see Section 11).
  - **De-identified / aggregated data** — information that has been processed so
    that it no longer identifies, and cannot reasonably be used to re-identify, any
    individual (Section 10).
  - **Consent Manager** — a DPDP-registered platform through which a Data Principal
    may give, manage, review, and withdraw consent (Section 17).

## 2. What personal data we collect

We collect personal data in three ways: information you give us, information
generated as you use ShowShak, and a limited amount of information from third
parties. We collect only what we need for the purposes in Section 4.

**2.1. Information you give us**
- **Account & identity:** your email address and the sign-in method you use
  (Google, Apple, or email); your display name; your **username/handle**; and,
  optionally, a **profile photo (avatar)**, **bio**, and **gender**.
- **Onboarding preferences:** your **taste/genres**, your **region**, and the
  **streaming platforms you tell us you subscribe to** (used only to route "Watch
  It" to a service you already have — never shown on your profile).
- **Curator content:** if you are a curator, the **clips** you upload (video and
  audio), captions/pitch text, the **titles** you link, vibe/genre tags, and the
  cover frame you choose.
- **Acceptances & records:** the **consent + 18+ acknowledgement** you give at
  sign-up, the one-time **Curator Terms acceptance** you give when you become a
  curator, and the per-clip **attestation** recorded when you publish (each stamped
  with who, when, and the policy versions in force).
- **Reports, complaints & support:** any **report, copyright complaint,
  counter-notice, grievance, or support request** you submit, including the name,
  contact details, and statements contained in it.

**2.2. Information generated as you use ShowShak**
- **Activity:** clips you **Fire** (like), curators you **follow**, clips you
  **save** into Stacks, clips you **view** (and approximate watch time), **shares**,
  searches you run, and **"Watch It" taps** (which title/platform, and your region).
- **Watch history:** a recently-watched list to help you re-find clips.
- **Device & technical data:** standard information your browser/app sends, such as
  **IP address**, device/browser type and settings, operating system, language,
  referring page, and **timestamps**; diagnostic and crash information; and
  **playback-quality telemetry** (e.g. buffering, resolution, errors) used to keep
  video smooth.
- **Cookies & local storage:** small files and storage keys used to keep you
  signed in and remember preferences (see Section 6).

**2.3. Information from third parties**
- **Sign-in providers:** if you sign in with Google or Apple, we receive the basic
  profile information you authorise (such as name, email, and avatar).
- **Service providers:** our processors (Section 11) may provide us technical and
  security information (for example, video-processing status from Mux).
- We do **not** buy personal data from data brokers, and we do **not** receive
  off-platform advertising or tracking data about you.

**2.4. Guest data.** If you use ShowShak before signing up, some activity (such as
views and fires) may be recorded under an **anonymous identifier**. If you later
sign up, this activity may be associated with your account so nothing you did is
lost.

**2.5. What we do NOT collect.** We do **not** intentionally collect special-category
or sensitive data (such as religion, health, sexual orientation, caste, or
biometrics), government identifiers, or payment-card information (there are no
payments in the beta). Please do not put such information into a clip, caption, bio,
or message. If you believe we have inadvertently received sensitive data, contact
us (Section 18) and we will delete it.

## 3. How the "hide the scoreboard" rule protects you

Some metrics are deliberately **private by database design**, not merely hidden in
the interface. A curator's **total fires-received** and **"Watch It" taps**, and any
individual's **"fires given"**, are **never shown publicly** and are enforced by
**row-level security** at the database layer. Public profiles show only followers
and clip count, plus per-clip fire and view counts. We treat your engagement as a
private signal, not a public scoreboard. This commitment also shapes what we will
and will not do with data commercially (Section 10).

## 4. Why we use your data, and our lawful basis

We process personal data only for lawful purposes. Under the DPDP Act we rely on
your **consent** and on **certain legitimate uses** the Act permits (such as a
purpose for which you have voluntarily provided your data, and complying with law).

| Purpose | What this involves | Typical lawful basis |
|---|---|---|
| Provide the core service | Authenticate you; show the feed; play clips; run Fire/Save/Follow; route "Watch It"; maintain Stacks and watch history | Consent / voluntary provision; performance of the service |
| Personalise your experience | Tailor the feed and discovery to your taste/genres and activity | Consent |
| Curator features & integrity | Publish clips; record attestations; show your public curator profile; prevent abuse and fake engagement | Consent / voluntary provision; legitimate use |
| Safety, moderation & legal | Handle reports, copyright complaints, counter-notices, and grievances; enforce the Terms; keep records the law requires | Compliance with law; legitimate use |
| Maintain, secure & improve | Diagnose problems, measure and improve video playback quality, prevent fraud and abuse, keep the service secure | Legitimate use |
| Communicate with you | Service and security messages; and, only if you opt in, product updates | Consent (for non-essential messages) |
| Build aggregate insights | Create **de-identified, aggregated** trends about what content and genres are resonating (Section 10) | Aggregated/de-identified data is outside "personal data" once it no longer identifies you |

We do **not** carry out automated decision-making that produces legal or similarly
significant effects on you. Personalisation and ranking are automated, but they
only order and surface clips — they do not decide anything of legal significance.

## 5. The "hide the scoreboard" commitment in practice — what we will not do

To make the Section 3 promise concrete, we commit that we will **not**:
- show any user their own "fires given" count, or expose any individual's giving
  behaviour publicly;
- publish a curator's total fires-received or Watch-It taps; or
- sell, rent, or disclose **personal data** that identifies you to advertisers,
  studios, or streaming platforms.

Where we describe future commercial uses (Section 10), they rest on
**aggregated, de-identified** data only.

## 6. Cookies, local storage, and similar technologies

6.1. We use **cookies** and **browser local storage / IndexedDB** to: keep you
signed in; remember preferences (such as mute state, recent searches, and feature
flags); cache page data and posters so the app loads quickly; and keep the service
secure. These are essential or functional technologies for a progressive web app.

6.2. During the beta we do **not** use advertising or cross-site tracking cookies,
and we do **not** allow third-party advertising networks to set tracking cookies
through ShowShak.

6.3. You can control cookies and storage through your browser settings, but some
features of the service rely on them and may not work if they are disabled.

## 7. Automated processing and recommendations

We use automated systems to rank and recommend clips (for example, surfacing
curators you follow, taste matches, and popular clips), to measure and improve
video playback, and to detect spam and abuse. These systems help present content;
they do **not** make decisions that have a legal or similarly significant effect on
you. You can influence personalisation by editing your genres and preferences in
Settings.

## 8. How long we keep data (retention)

8.1. We keep your account and content **while your account is active**.

8.2. When you **delete** your account, we hide it immediately and **permanently
erase** personal data after a limited **restore window (about 30 days)**, after
which it is removed from active systems, except for data we must retain (8.4).

8.3. **Routine backups** may persist for a limited period before rotation; data in
backups is overwritten on the normal backup cycle.

8.4. **Records we retain by law or for legal defensibility** — even after a clip or
account is removed — include: the **consent and Curator-Terms acceptance records**,
the per-clip **attestations**, and the **moderation / copyright / grievance audit
log** (who reported what, what we did, and when). These prove rights-holder
responsibility and our compliant handling of complaints, and are kept only as long
as necessary for those purposes or as the law requires.

8.5. We decide retention on a case-by-case basis using: whether we still need the
data to provide the service, the nature and sensitivity of the data, applicable
legal obligations, and whether we need it to establish, exercise, or defend legal
claims or to protect safety and security.

## 9. How we share information

We share personal data only in the limited circumstances below. **We do not sell
your personal data**, and we require everyone we share data with to protect it and
use it only for the purpose we share it.

**9.1. Service providers (Data Processors).** We share personal data with vendors
that process it **on our behalf and on our instructions**, under contractual
confidentiality and security obligations, to operate ShowShak. See the list in
Section 11.

**9.2. With your direction or consent.** If you ask us to, or you use a feature that
shares data (for example, signing in through Google/Apple, or sharing a clip link),
we share the relevant information to do what you asked.

**9.3. Legal, safety, and protection of rights.** We may access, preserve, and
disclose data to courts, law-enforcement, or government authorities, or to other
parties, where we have a good-faith belief it is reasonably necessary to: comply
with applicable law, regulation, legal process, or an enforceable government
request; enforce our Terms and policies, including investigating violations; detect,
prevent, or address fraud, security, or technical issues; or protect the rights,
property, or safety of ShowShak, our users, or the public.

**9.4. Corporate transactions.** If ShowShak is involved in a merger, acquisition,
financing, reorganisation, or sale of assets, your information may be transferred as
part of that transaction. We will continue to protect your personal data and will
give affected users notice before personal data becomes subject to a different
privacy policy.

**9.5. Aggregated and de-identified data.** We may create, use, and share
**aggregated and de-identified** information that does not identify you, as
described in Section 10.

**9.6. What we do not do.** We do **not** share personal data that identifies you
with advertisers, studios, or streaming platforms; we do **not** sell personal data;
and during the beta we do **not** disclose personal data for third-party
advertising or marketing.

## 10. Aggregated and de-identified data (our insights commitment)

10.1. **What this is.** A core part of ShowShak's purpose is to understand, at the
level of the market and the audience, **what content and genres are resonating** —
for example, "crime thrillers are trending in India this month," or "this title is
converting attention into Watch-It taps." To do this we create **aggregated and
de-identified** datasets and insights.

10.2. **No identification.** Aggregated and de-identified data is processed so that
it **no longer identifies you and cannot reasonably be used to re-identify you**. We
do **not** attempt to re-identify individuals from such data. Once data is genuinely
aggregated/de-identified it is no longer "personal data" under the DPDP Act.

10.3. **How we may use and share it.** We may use aggregated/de-identified insights
to operate, analyse, and improve ShowShak, and we **may share** such insights with
third parties, including streaming platforms and studios, as **market and audience
trends** — never as a report that identifies any individual user or reveals any
individual's private activity. This is consistent with our "hide the scoreboard"
commitment (Sections 3 and 5).

10.4. **Beta status.** During the non-commercial beta we are building the product,
not selling insights. Any commercial sharing of aggregated/de-identified insights
will be conducted consistently with this Section and applicable law.

## 11. Advertising and monetisation status

11.1. **Today.** During the beta there is **no advertising**, **no promoted/sponsored
clips**, and **no use of your personal data for third-party ad targeting**.

11.2. **In the future.** If we later introduce advertising, promoted clips, or other
monetisation that uses **personal data**, we will: update this Policy and publish a
**new version**; describe the new purpose clearly; and obtain your **fresh consent**
where the law requires it, before using your personal data for that new purpose. We
will not repurpose data you gave us under this Policy for a materially different
purpose without doing so.

## 12. Who processes data for us (sub-processors)

We share personal data only with service providers that help us operate ShowShak,
under contractual confidentiality and security obligations:

| Processor | Role | Notes |
|---|---|---|
| **Supabase** | Database, authentication, image storage, serverless functions | Hosted in the **Mumbai, India** region |
| **Mux** | Video upload, encoding, streaming, and playback-quality analytics | Receives clip video + playback technical data |
| **Google / Apple** | Sign-in (OAuth), if you choose them | We receive basic profile info you authorise |
| **TMDB** | Show/movie titles and "where to watch" data | We send **title queries**, not your personal data; the browser never contacts TMDB directly |
| **jsDelivr (CDN)** | Serves software libraries to your browser | May receive your IP as part of standard web requests |

We keep this list current and update it when our processors change.

## 13. International transfers

Core personal data is stored in **India** (Supabase, Mumbai region). Some
processors (for example, Mux, the CDN, and the OAuth sign-in providers) may process
limited data outside India. Where that happens, we rely on the provider's
contractual safeguards and process such transfers consistent with the DPDP Act and
any restrictions on cross-border transfer that the Central Government notifies.

## 14. Children

ShowShak's beta is **for users 18 and older only** (Section 1.3). We do not knowingly
collect personal data from anyone under 18, and we do not direct any tracking,
behavioural monitoring, or targeted advertising at children. If you believe a minor
has provided us personal data, contact **[GRIEVANCE_EMAIL]** and we will delete it.

## 15. Your rights (DPDP Act)

As a Data Principal you have the right to:
- **Access** — obtain a summary of the personal data we process about you and the
  processing activities we carry out;
- **Correction, completion, and updating** — have inaccurate or incomplete data
  corrected, completed, or updated;
- **Erasure** — have your personal data erased (subject to records we must keep by
  law — Section 8.4);
- **Withdraw consent** — withdraw consent at any time, as easily as you gave it;
  withdrawal does not affect processing already carried out lawfully (Section 17);
- **Nominate** — nominate another person to exercise your rights in the event of
  your death or incapacity; and
- **Grievance redressal** — have your grievance addressed by us (Section 18) and, if
  unresolved, escalate to the **Data Protection Board of India**.

To exercise any right, contact us at **[GRIEVANCE_EMAIL]**. Many controls (edit
profile, manage platforms, clear watch history, deactivate or delete your account)
are also available directly in **Settings**. We will respond within the timelines
required by law and may need to verify your identity before acting on a request.

## 16. Your duties (DPDP Act)

The DPDP Act also places certain duties on Data Principals: do not impersonate
someone else when providing personal data; do not suppress material information or
provide false particulars when, for example, applying for an account; and do not
file false or frivolous grievances or complaints. Please give us accurate
information and use the grievance and reporting features in good faith.

## 17. Consent and how to withdraw it

17.1. **How we obtain consent.** Where we rely on consent, we ask for it through a
clear, affirmative action — for example, the unticked checkboxes at sign-up for the
Terms of Service and Privacy Policy and the 18+ confirmation. Our request is
specific and informed, and limited to the purposes described in this Policy.

17.2. **How to withdraw.** You can withdraw consent at any time by deleting your
account in Settings, by turning off optional processing where we offer that control,
or by contacting **[GRIEVANCE_EMAIL]**. Withdrawing consent may mean we can no
longer provide some or all of the service.

17.3. **Consent Manager.** The DPDP framework provides for **Consent Managers** —
registered platforms through which you can give, manage, review, and withdraw
consent. Where Consent Managers become available and applicable, we will support
giving and withdrawing consent through them.

## 18. Security

18.1. We use technical and organisational measures appropriate to a beta service,
including **encryption in transit**, access controls, and **row-level security** that
enforces, at the database layer, who may read or write each kind of data.

18.2. We restrict access to personal data to people who need it to operate the
service, under confidentiality obligations.

18.3. No method of transmission or storage is perfectly secure, and we cannot
guarantee absolute security.

## 19. Data-breach notification

If a personal-data breach occurs, we will take reasonable steps to contain and
assess it and will **notify the Data Protection Board of India and affected Data
Principals** in the manner and within the timelines required by the DPDP Act and
the DPDP Rules.

## 20. Grievance Officer and contact

In accordance with the IT Rules 2021 and the DPDP Act, you may contact:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL]
- **Address:** [REGISTERED_ADDRESS], India

We **acknowledge complaints within 24 hours** and **resolve them within 15 days**.
General privacy questions: **[SUPPORT_EMAIL]**. If you are not satisfied with our
response, you may escalate to the **Data Protection Board of India**.

## 21. Changes to this Policy

We may update this Policy. We will post the new version with an updated effective
date and, for material changes, take reasonable steps to notify you and, where
required, seek fresh consent before the change affects you. Prior versions are
retained and identifiable by version label.

---

*ShowShak is an open beta operated in India. This document is a draft pending
review by qualified Indian legal counsel and is not legal advice. The DPDP Act,
2023 and DPDP Rules, 2025 (notified 13 November 2025) are being brought into force
in phases — substantive notice/consent/rights obligations and penalties commence
around May 2027 — and we will adjust this Policy as those obligations commence.*
$SS$, true
where not exists (select 1 from policy_versions where doc='privacy' and version='1.1-draft');

-- ───────────────────────────────────────────────────────────────
-- CURATOR TERMS  (doc='curator' ← legal/curator-terms.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'curator', '1.1-draft', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Curator Terms

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> These Curator Terms are a binding agreement between you (the "**curator**") and
> **[ENTITY_NAME]**, the operator of ShowShak. They set out what rights you keep in
> the clips you post, the licence you grant us to run them, and the responsibilities
> you accept as a curator. By accepting these Curator Terms and activating the
> curator role, you agree to them. They form part of, and are enforced under, the
> **Terms of Service**, and they incorporate the **Community Guidelines** and the
> **Copyright Policy** by reference.

> **At a glance (not a substitute for the full Terms):**
> - You **own** your clips. You grant us a licence to host and show them.
> - You confirm that, **for every clip you post**, you have the rights to the video
>   **and audio** in it.
> - You accept these Curator Terms **once**. After that, **the act of posting a
>   clip** is your confirmation that this rights warranty applies to that clip, and
>   ShowShak **automatically records a per-clip attestation** for compliance — you
>   are not asked to re-sign a form on every upload.
> - You are **responsible** for your clips and **indemnify** ShowShak.
> - Don't post infringing content, and don't add music/audio you aren't licensed to
>   use.

---

## 1. Who we are and what ShowShak is

1.1. ShowShak ("**ShowShak**", "**we**", "**us**", "**our**") is operated by
**[ENTITY_NAME]**, [ENTITY_TYPE], having its registered/operating address at
**[REGISTERED_ADDRESS]**, India.

1.2. ShowShak is a **streaming-discovery service**. Curators post short vertical
video clips recommending shows and movies; viewers watch the clips and, if
interested, tap **"Watch It"** to be directed to the third-party streaming platform
where the title is available.

1.3. **Intermediary status.** ShowShak is an *intermediary* under §2(1)(w) of the
Information Technology Act, 2000, and maintains safe harbour under **§79 of the IT
Act** and the **IT Rules 2021** by observing due diligence and acting on valid
notices and court/government orders. Curators upload their own clips; we do not
initiate the transmission, select the receiver, or select or modify a clip, except
as required to operate the service (for example, transcoding and thumbnails).

## 2. How acceptance works (one-time, with a per-clip record)

2.1. **One-time, relationship-level acceptance.** You accept these Curator Terms
**once**, when you activate the curator role. They then govern every clip you post
for as long as you remain a curator.

2.2. **The rights warranty is forward-looking.** The representations and warranties
in Section 5 are given **for each clip you post** — they apply to every future clip
automatically, not just to clips existing at the moment you accept.

2.3. **Per-clip attestation record (no repeated form).** So that each upload is
provable for safe-harbour purposes, ShowShak **automatically records a per-clip
attestation** when you publish a clip (the publishing curator, the time, and the
policy versions in force). **The act of publishing a clip is your affirmation that
the Section 5 warranty applies to that clip.** We do this without asking you to
re-accept a separate legal form on every upload, so your creative flow is not
interrupted — but the underlying responsibility and record are unchanged. **No clip
goes live without a recorded attestation.**

## 3. You keep ownership of your clips

3.1. **Ownership retained.** You **retain ownership** of the clips you post to
ShowShak ("**Your Clips**"), including the copyright in any original material you
created. Nothing in these Terms transfers ownership of Your Clips to ShowShak.

3.2. These Terms grant us only the **licence** described in Section 4 — a permission
to use Your Clips to operate the service. You remain free to use Your Clips
elsewhere, subject to the rights of any third parties whose material they contain.

## 4. The licence you grant ShowShak (essential)

4.1. **Licence grant.** For each clip you post, and for as long as that clip is on
the platform, you grant ShowShak a **non-exclusive, worldwide, royalty-free,
sublicensable** licence — extending to ShowShak and to its infrastructure,
content-delivery (CDN), and video providers (for example, **Mux**) — to **host,
store, reproduce, transcode, create thumbnails, previews, captions, and summaries
of, display, distribute, and promote** the clip on and through the service. For this
purpose "the clip" includes its caption, tags, and other metadata.

4.2. **Why this licence is needed.** This licence is what lets ShowShak and the
technical providers that power it actually run the service: storing your upload,
converting it into streamable formats, generating thumbnails and previews,
delivering it to viewers through a CDN, and showcasing it within the service. The
licence is **non-exclusive** (you keep your own rights — Section 3),
**royalty-free** (we do not pay you and you do not pay us during the non-commercial
beta), and **sublicensable** only so far as necessary for those providers to perform
these functions on our behalf.

4.3. **Scope.** The licence includes all rights reasonably necessary for us to
exercise the permissions above. It is in addition to any other licence you may grant
(for example, a Creative Commons licence). To the extent permitted by law, you waive
any moral-rights claim that would prevent us from carrying out the permitted technical
operations (such as transcoding or generating a thumbnail); this does not permit us
to misattribute your clip.

4.4. **Profile identifiers.** You permit us to display your username, avatar, and bio
on your public curator profile and within the service. You can change or remove these
in Settings or by deleting your account.

4.5. **Duration and end of licence.** The licence runs for **as long as the clip is
on the platform**. When the clip is **removed** — by you, or by us under the Terms of
Service, the Community Guidelines, or the Copyright Policy — the licence **ends**,
**except** for (i) copies retained in routine **backups** for a limited period, and
(ii) copies retained where required by law or to resolve disputes or enforce our
agreements (a reasonable **legal-retention tail**, including attestation and
moderation records).

## 5. Your rights warranty (given for every clip)

5.1. **You represent and warrant** that, for each clip you post, you **created the
clip or hold all necessary rights, licences, and permissions** to it and to
**everything in it** — including the **video**, the **audio and music**, and any
**third-party material** — and to grant the licence in Section 4.

5.2. You further represent and warrant that the clip **does not infringe** any third
party's copyright, trademark, design, publicity, privacy, or other rights; that you
have obtained any necessary consents or releases from people who appear in it; and
that it does not otherwise violate these Terms, the Community Guidelines, the
Copyright Policy, or any applicable law.

5.3. You represent and warrant that ShowShak will not need to obtain any licence
from, or pay any royalty to, a third party in order to host and stream the clip as
permitted here.

## 6. Your responsibility and indemnity

6.1. **Sole responsibility.** You — not ShowShak — are **solely responsible** for
Your Clips, including the video, audio, captions, and any title you reference.

6.2. **Indemnity.** You agree to **indemnify, defend, and hold harmless** ShowShak,
[ENTITY_NAME], and its personnel from and against any claim, demand, loss, liability,
cost, or expense (including reasonable legal fees) **arising out of or related to Your
Clips**, your use of the service, or your breach of these Terms. This Section survives
termination of your account and of these Terms.

## 7. ShowShak claims no ownership — we are a neutral host

7.1. **No ownership claim.** ShowShak **claims no ownership** of Your Clips. The
licence in Section 4 does not make us the owner of anything you post.

7.2. **Neutral host and showcase.** ShowShak is a **neutral host and showcase** for
curator clips. We do not pre-screen or endorse Your Clips; recommendations and
opinions in a clip are the curator's own.

7.3. **We do not host the underlying titles.** ShowShak **does not host, license, or
provide the underlying shows or movies**. We are a discovery layer. The **"Watch It"**
action **links out to third-party streaming platforms** (for example, Netflix, Prime
Video, JioHotstar), which are operated by others under their own terms. Title and
availability data come from third parties (for example, TMDB) and from the curator's
declaration, and may be inaccurate or out of date. Trademarks and titles belong to
their respective owners; their appearance on ShowShak does not imply affiliation or
endorsement.

## 8. Rules you agree to follow

8.1. **Community Guidelines and Copyright Policy.** You agree to the **Community
Guidelines** and the **Copyright Policy**, both incorporated by reference.

8.2. **No infringing content; no unlicensed music or audio.** You will **not** post
infringing content, and you will **not** add **music or audio you are not entitled to
use**. During the beta, ShowShak does not provide a catalogue of copyrighted music to
add to clips, and you must not add any you are not licensed to use. This protects every
curator's safe-harbour position.

8.3. **Title-blind by design.** Clips do not display the show/movie title until the
"Watch It" moment — please do not defeat this by unnecessarily putting the title in
the clip itself.

8.4. **Repeat infringers.** ShowShak maintains a **repeat-infringer policy**. Curators
whose clips are repeatedly the subject of substantiated rights complaints may be
**suspended or terminated**, as described in the Community Guidelines and the
Copyright Policy.

## 9. Promoted clips and monetisation (status and future)

9.1. **Today.** During the beta there is **no payment to curators, no advertising, and
no promoted/sponsored clips**.

9.2. **If introduced later.** If we introduce promoted clips or curator monetisation,
it will be **opt-in** (you choose whether to participate), **clearly labelled** as
advertising/sponsored where required (consistent with ASCI guidelines and the IT
Rules), **rate-limited** to protect the trust of your audience, and governed by
additional terms you accept before participating. Mandatory disclosure of paid
promotion is your responsibility as well as ours.

## 10. Takedown, grievances, and how complaints are handled

10.1. **Takedown.** Copyright complaints about a clip are handled under our
**Copyright Policy**, which follows **Rule 75 of the Copyright Rules, 2013** and the IT
Act, 2000: on a valid, good-faith complaint a clip is **disabled within 36 hours** and
may be **restored** if no court order is produced within **21 days**, as described
there. A curator whose clip is disabled may respond as set out in the Copyright
Policy.

10.2. **Grievances.** For complaints about content or about our handling of your data,
contact our **Grievance Officer**, who **acknowledges every complaint within 24 hours**
and **resolves it within 15 days** of receipt, as required by Rule 3(2) of the IT
Rules 2021:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL] (copyright matters: **[COPYRIGHT_EMAIL]**)
- **Address:** [REGISTERED_ADDRESS], India

10.3. The in-app takedown form is available at **[WEBSITE_URL]showshak-dmca.html**.

## 11. Suspension and termination

11.1. We may **remove or disable** Your Clips and may **suspend or terminate** your
curator role or account for breach of these Terms, the Community Guidelines, the
Copyright Policy, or applicable law, or in response to a valid legal request. We will
give notice where reasonably practicable; for serious breaches we may act
immediately.

11.2. On removal of a clip or termination of your account, the licence in Section 4
ends as described in Section 4.5 (subject to backups and the legal-retention tail).
Sections that by their nature should survive (including 3, 5, 6, 7, and 10) survive
termination.

11.3. You may stop being a curator at any time from Settings, and you may delete your
account; your clips are handled as described in Section 4.5 and the Privacy Policy.

## 12. Changes to these Terms

12.1. We may update these Curator Terms. We will post the updated version with a new
effective date, and your continued curation after the effective date means you accept
the updated Terms. For material changes we will take reasonable steps to notify you.
Prior versions are retained and remain identifiable by version label.

## 13. Contact

Questions about these Curator Terms: **[SUPPORT_EMAIL]**.
Grievances: **[GRIEVANCE_EMAIL]** (Section 10).
Copyright: **[COPYRIGHT_EMAIL]** (see the Copyright Policy).

---

*ShowShak is an open beta operated in India. This document is a draft pending review
by qualified Indian legal counsel and is not legal advice.*
$SS$, true
where not exists (select 1 from policy_versions where doc='curator' and version='1.1-draft');

-- ───────────────────────────────────────────────────────────────
-- COPYRIGHT POLICY & TAKEDOWN  (doc='copyright' ← legal/copyright-policy.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'copyright', '1.1-draft', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Copyright Policy & Takedown Procedure

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> ShowShak respects intellectual property and expects its users to do the same. This
> policy explains how we handle alleged copyright infringement, how rights holders
> can request removal of a clip, how curators can respond, and our repeat-infringer
> policy. It is written for **India** (Copyright Act, 1957; Copyright Rules, 2013;
> Information Technology Act, 2000), and also accepts US-style "DMCA" notices from
> foreign rights holders. It forms part of, and is enforced under, the **Terms of
> Service** and **Curator Terms**.

> **At a glance (not a substitute for the full policy):**
> - Think a clip infringes your work? Send a notice via the in-app form or
>   **[COPYRIGHT_EMAIL]** with the details in Section 3.
> - On a valid notice, we **disable the clip within 36 hours**.
> - The clip stays down for **21 days**; if the complainant gets a court order, it
>   stays down — otherwise it may be restored.
> - The curator can **respond** (Section 5).
> - **Repeat infringers** can be suspended or terminated (Section 6).
> - **False notices** can carry legal consequences (Section 7).

---

## 1. Our role: a neutral intermediary

1.1. ShowShak is an **intermediary** under the IT Act, 2000. Curators upload their own
clips. We do not create, select, or modify clip content. Under **§79 of the IT Act**
and Rule 3 of the IT Rules 2021, we maintain safe-harbour by observing due diligence
and acting on valid notices and court/government orders.

1.2. **Curator responsibility.** Every curator accepts the **Curator Terms** (in which
they warrant they hold the rights to the video and audio in each clip and accept
responsibility and indemnity), and ShowShak **records a per-clip attestation** when a
clip is published (see Terms of Service Section 6 and Curator Terms Section 2).
Responsibility for a clip rests with the curator who uploaded it.

1.3. **No "DMCA" statute in India.** The US Digital Millennium Copyright Act does not
apply here. In India, copyright takedowns are governed by the **Copyright Act, 1957**
and **Rule 75 of the Copyright Rules, 2013**, summarised below. We use the word "DMCA"
only because international rights holders search for it; the governing process is the
Indian one. We will, however, accept and act on notices from foreign rights holders
that contain the same essential information.

## 2. Who receives copyright notices

2.1. Send copyright complaints to our designated contact:

- **Attn:** Copyright / Grievance Officer — [GRIEVANCE_OFFICER_NAME]
- **Email:** [COPYRIGHT_EMAIL]
- **In-app form:** [WEBSITE_URL]showshak-dmca.html
- **Address:** [REGISTERED_ADDRESS], India

2.2. This contact is monitored. The Grievance Officer **acknowledges every complaint
within 24 hours** and **resolves it within 15 days** (Section 8), and copyright
takedowns also follow the 36-hour / 21-day mechanics in Section 4.

## 3. How to report alleged copyright infringement (Notice)

If you are a copyright owner (or authorised to act for one) and believe a clip on
ShowShak infringes your work, send us a written complaint. **A valid notice must
include all of the following** (consistent with Rule 75 of the Copyright Rules,
2013):

1. **Identification of the work** — a description of the copyrighted work you claim is
   infringed, with enough detail to identify it (and, if possible, proof or a
   reference establishing your ownership/authority).
2. **Identification and location of the infringing clip** — the ShowShak **clip ID or
   URL** so we can find it. *(You do not need to state, and we do not require, the
   show/movie title shown to viewers — clips are title-blind by design.)*
3. **Your details** — your name, address, and contact email; and, if you are an
   agent, the rights holder you represent and your authority to act.
4. **A good-faith statement** — that you believe in good faith the use complained of
   is not authorised by the owner, its agent, or the law.
5. **An accuracy & authority statement** — that the information in the notice is
   accurate and that you are the owner or are authorised to act on the owner's behalf,
   made under penalty of perjury / liability for misstatement.
6. **Your signature** — physical or electronic.

Incomplete notices may not be actionable; we may ask you to supply missing elements.

## 4. What we do with a valid notice (the Rule 75 process)

4.1. **Restrict access within 36 hours.** On receiving a complete, good-faith notice,
we will **disable public access to the identified clip within thirty-six (36) hours**
(the clip's status is set to *removed* and it is hidden from every public surface).
This mirrors Rule 75(3) of the Copyright Rules, 2013.

4.2. **21-day window.** The clip remains disabled for **twenty-one (21) days**. Within
that period, the complainant must produce an **order from a competent court** directing
ShowShak to keep the clip disabled.
  - If we receive such a court order within 21 days, the clip stays disabled per the
    order.
  - **If no court order is produced within 21 days, we may restore access** to the
    clip, as contemplated by Rule 75.

4.3. **Notice to the curator.** We will make reasonable efforts to inform the affected
curator that their clip was disabled following a complaint, and how to respond
(Section 5).

4.4. **Court orders / government notifications.** Independently of the above, we act on
a binding **court order** or **government notification** under the IT Act and *Shreya
Singhal v. Union of India* (2015).

## 5. Counter-response by the curator

5.1. A curator whose clip was disabled may **respond** (a "counter-notice"), stating
why they believe the clip is lawful — for example, that they hold the rights, that the
use is fair dealing under §52 of the Copyright Act, or that the notice misidentified
the clip.

5.2. A counter-response must include the curator's name and contact details, an
identification of the disabled clip, the curator's statement of why it is lawful, and
the curator's physical or electronic signature. We will record it and consider it in
good faith.

5.3. **Restoration.** If the 21-day period passes with no court order from the
complainant (Section 4.2), or if we determine the complaint was invalid or mistaken,
we may **restore the clip** (status returned to *live*).

5.4. We are not a court. Where a genuine dispute over rights exists, the parties may
need to resolve it through the courts; ShowShak will comply with binding orders.

## 6. Repeat-infringer policy

6.1. ShowShak maintains a **repeat-infringer policy**. Where a curator's clips are
repeatedly the subject of substantiated copyright complaints (the clip is removed and
not later restored), we record a **strike** and may, in appropriate circumstances,
**suspend or terminate** that curator's account.

6.2. A complaint that is **withdrawn, rejected, or that results in the clip being
restored** does **not** count as a strike against the curator. The detailed strike
threshold and window are set out in the **Community Guidelines**.

6.3. We keep an **append-only audit record** of complaints and actions so that any
termination decision is consistent and provable.

## 7. Misuse of this process

7.1. **Do not file false notices.** Knowingly making a material misrepresentation in a
takedown notice (or a counter-response) may expose you to liability under applicable
law. We may reject, deprioritise, or act against accounts that abuse this process,
including by making groundless, vexatious, or repetitive submissions.

## 8. Grievance Officer (IT Rules 2021)

For copyright complaints and any grievance about our handling of them, contact:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL] (copyright matters: **[COPYRIGHT_EMAIL]**)
- **Address:** [REGISTERED_ADDRESS], India

The Grievance Officer **acknowledges every complaint within 24 hours** and **resolves
it within 15 days** of receipt, as required by Rule 3(2) of the IT Rules 2021.
(Copyright takedowns also follow the 36-hour / 21-day mechanics in Section 4.)

## 9. About the underlying titles ("Watch It")

ShowShak does not host shows or movies. Clips link out to third-party streaming
platforms via "Watch It". Title and availability data come from third parties (for
example, TMDB) and the curator's declaration. Trademarks and titles belong to their
respective owners; their appearance on ShowShak does not imply affiliation or
endorsement.

## 10. Changes to this Policy

We may update this Policy and will post the updated version with a new effective date.
Prior versions are retained and identifiable by version label.

---

*ShowShak is an open beta operated in India. This document is a draft pending review
by qualified Indian legal counsel and is not legal advice. The Rule 75 process
described here should be confirmed with counsel before launch, including the
registered details of the person/officer to receive notices.*
$SS$, true
where not exists (select 1 from policy_versions where doc='copyright' and version='1.1-draft');

-- ───────────────────────────────────────────────────────────────
-- COMMUNITY GUIDELINES & REPEAT-INFRINGER POLICY  (doc='community' ← legal/community-guidelines.md)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'community', '1.1-draft', date '2025-01-01',
       $SS$<!-- DRAFT — COUNSEL REVIEW REQUIRED BEFORE LAUNCH. Not legal advice. -->
# ShowShak — Community Guidelines & Repeat-Infringer Policy

**Version:** [VERSION] · **Effective date:** [EFFECTIVE_DATE]
**Status:** Open beta — India only (the website is publicly accessible; clip upload is limited to invited curators)

> These Guidelines explain what's allowed on ShowShak and what happens when someone
> breaks the rules. They form part of, and are enforced under, the **Terms of
> Service**, and they reflect the due-diligence content rules in **Rule 3(1)(b) of the
> IT Rules 2021**. They apply to clips, captions, profiles, handles, comments,
> messages, and conduct on the service.

> **At a glance (not a substitute for the full Guidelines):**
> - Post only content you have the **right** to post — video **and** audio.
> - No unlicensed music, no infringing clips.
> - No illegal, hateful, sexual, child-endangering, deceptive, or dangerous content.
> - Be decent: no harassment, spam, or fake engagement; don't game the system.
> - Breaking the rules can mean a removed clip, a warning, suspension, or
>   termination. Repeat copyright infringement leads to account loss (Section 7).

---

## 1. The spirit of ShowShak

ShowShak is a trust-based, creator-curated discovery layer. Curators recommend shows
and movies they love; viewers discover what to watch next and tap "Watch It" to go to
the streaming platform. Keep it about genuine taste, respect other people, and only
post what you have the right to post. The trust between curators and viewers is the
heart of the product — these Guidelines exist to protect it.

## 2. Post only content you have the right to post

2.1. Upload only clips you created or for which you hold **all necessary rights,
licences, and permissions** — for the **video and the audio**. You confirm this when
you accept the Curator Terms, and ShowShak records a per-clip attestation when you
publish (see Terms of Service Section 6 and Curator Terms Section 2).

2.2. **No music library / no "use this song".** During the beta, ShowShak does not
provide a catalogue of copyrighted music to add to clips, and you must not add music
or audio you are not entitled to use. (This protects every curator's safe-harbour
position.)

2.3. **Title-blind by design.** Clips do not display the show/movie title until the
"Watch It" moment — please don't defeat this by putting the title in the clip itself
unnecessarily.

2.4. **Obtain releases.** If real people appear in your clip, make sure you have any
consents or releases needed before you post.

## 3. Prohibited content (Rule 3(1)(b), IT Rules 2021)

Do not upload, post, share, or display content that:

1. **Infringes rights** — infringes any patent, trademark, copyright, design,
   publicity, or other proprietary right, or belongs to someone else and to which you
   have no right.
2. **Is obscene or sexual** — is defamatory, obscene, pornographic, paedophilic, or
   invasive of another's privacy (including bodily privacy); is sexually explicit; or
   promotes a sexual service.
3. **Harms or endangers children** — is harmful to a child, or exploits, sexualises,
   or endangers minors in any way. We report child sexual abuse material to the
   appropriate authorities.
4. **Is hateful or harassing** — is insulting or harassing on the basis of gender; is
   racially or ethnically objectionable; or promotes hatred, discrimination, or
   violence against people based on a protected characteristic.
5. **Promotes violence or terror** — promotes or supports terror or hate groups;
   depicts gratuitous, realistic, or sexualised violence; or provides instructions for
   weapons or explosives.
6. **Encourages self-harm** — depicts or encourages self-harm or suicide.
7. **Is deceptive or false** — deceives or misleads about the origin of a message; is
   patently false or misinformation that can cause harm; impersonates another person;
   or contains harmful false claims (for example, about health or voting).
8. **Threatens India's security** — threatens the unity, integrity, defence, security,
   or sovereignty of India, friendly relations with foreign States, or public order;
   incites a cognisable offence; or prevents investigation of an offence.
9. **Is malicious code** — contains a software virus or any other malicious code,
   file, or program.
10. **Promotes fraud** — promotes fraudulent or dubious money-making schemes, proposes
    an unlawful transaction, or uses deceptive marketing.
11. **Violates law** — otherwise violates any applicable law in force.

See the Terms of Service and Copyright Policy for how these rules are enforced.

## 4. Behave well (code of conduct)

In using ShowShak, you must not:
- harass, bully, threaten, stalk, or abuse curators or users;
- use an offensive or impersonating handle, display name, or avatar;
- spam, post misleading metadata, or run scams;
- manipulate fires, views, follows, or any other signal (no fake engagement, bots, or
  coordinated manipulation);
- collect or publish others' personal data without authorisation (no doxxing);
- misuse the "Watch It", report, or grievance features, including **false takedown or
  counter-notice filings** or vexatious complaints; or
- scrape, reverse-engineer, overload, or interfere with the service, or try to access
  data or accounts you are not authorised to access.

## 5. Reporting

5.1. If you see content that breaks these Guidelines, report it. For **copyright**,
use the takedown process in the Copyright Policy (in-app form at
**[WEBSITE_URL]showshak-dmca.html** or **[COPYRIGHT_EMAIL]**).

5.2. For copyright complaints we follow the **36-hour / 21-day** process in the
Copyright Policy. For other grievances, our Grievance Officer **acknowledges within 24
hours** and **resolves within 15 days** (Section 8).

5.3. Please report in good faith. Knowingly false or frivolous reports may themselves
breach these Guidelines.

## 6. Enforcement — what we may do

6.1. Depending on the severity and history of a violation, we may:
- remove or disable a clip;
- issue a warning;
- limit certain features;
- temporarily **suspend** an account; or
- **terminate** an account.

6.2. We act on valid notices, court orders, and government notifications, and we may
act to protect users and the integrity of the service. Where reasonably practicable
we give notice; for serious violations we may act immediately.

## 7. Repeat-Infringer Policy

7.1. **Strikes.** A **strike** is recorded against a curator when a copyright complaint
(or other rights complaint) against one of their clips is **substantiated and
actioned** (the clip is removed and not later restored).

7.2. **No strike where the curator is vindicated.** If a complaint is withdrawn or
rejected, or the clip is **restored** (for example, no court order within the 21-day
window, or the complaint was mistaken), the associated strike is **voided** and does
**not** count.

7.3. **Threshold.** A curator who accumulates **[THRESHOLD] substantiated strikes
within a rolling [WINDOW_DAYS]-day period** is subject to **suspension or
termination** of their account.
  > *Placeholder values — counsel review required.* A common starting posture is **3
  > strikes within 180 days**, but the exact threshold and window must be set with
  > counsel before launch. These values are defined **only here**.

7.4. **Provable and consistent.** Strikes and termination decisions are derived from an
**append-only moderation audit log**, so outcomes are consistent and provable after
the fact.

7.5. **Serious cases.** A single egregious violation (for example, a clear, repeated,
or commercial-scale infringement, or illegal content such as child sexual abuse
material) may lead to immediate termination, regardless of the strike count.

## 8. Appeals and grievances

If you believe an enforcement action was a mistake, contact our Grievance Officer:

- **Grievance Officer:** [GRIEVANCE_OFFICER_NAME]
- **Designation:** Grievance Officer
- **Email:** [GRIEVANCE_EMAIL]
- **Address:** [REGISTERED_ADDRESS], India

We **acknowledge within 24 hours** and aim to **resolve within 15 days**. You may
explain why you believe the action was wrong; we will review it in good faith and
restore content or access if appropriate.

## 9. Changes

We may update these Guidelines and will post the updated version with a new effective
date. Prior versions are retained and identifiable by version label.

---

*ShowShak is an open beta operated in India. This document is a draft pending review
by qualified Indian legal counsel and is not legal advice.*
$SS$, true
where not exists (select 1 from policy_versions where doc='community' and version='1.1-draft');

-- ───────────────────────────────────────────────────────────────
-- REPOINT is_current → make ONLY version '1.1-draft' current per doc.
-- (Prior version rows are retained for audit; just deactivated.)
-- ───────────────────────────────────────────────────────────────
update policy_versions set is_current = false where doc='tos' and version <> '1.1-draft' and is_current;
update policy_versions set is_current = false where doc='privacy' and version <> '1.1-draft' and is_current;
update policy_versions set is_current = false where doc='curator' and version <> '1.1-draft' and is_current;
update policy_versions set is_current = false where doc='copyright' and version <> '1.1-draft' and is_current;
update policy_versions set is_current = false where doc='community' and version <> '1.1-draft' and is_current;

-- Reload PostgREST so reads see the new rows immediately.
notify pgrst, 'reload schema';

-- ── Re-seed recipe for counsel-approved FINAL text ──
--   1. Fill every [PLACEHOLDER] in legal/*.md and have counsel approve.
--   2. Bump VERSION in data/_gen_policy_seed.js (e.g. '1.0'), set EFFECTIVE_DATE.
--   3. node data/_gen_policy_seed.js  → regenerates this file.
--   4. Paste into the Supabase SQL editor and Run (idempotent; repoints is_current).
