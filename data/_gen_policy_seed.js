/* _gen_policy_seed.js — regenerate supabase/seed/seed_policy_versions.sql from the
   canonical legal/*.md drafts, so the seeded policy_versions bodies are always a
   VERBATIM copy of the source documents (no hand-transcription drift).

   Run:  node data/_gen_policy_seed.js
   Then paste the regenerated supabase/seed/seed_policy_versions.sql into the
   Supabase SQL editor (after migration 0031 is applied) and Run.

   Notes:
   - Version is bumped to '1.1-draft' (the expanded drafts). Bodies still carry
     [PLACEHOLDER] tokens → showshak-legal.html keeps the "counsel review required"
     banner up (ssPolicyNeedsCounselReview). Fill placeholders + counsel-approve,
     then bump to a final version and re-run.
   - Each insert is idempotent (guarded by NOT EXISTS on (doc, version)).
   - After inserting, is_current is repointed so ONLY the new version is current
     per doc (prior rows are deactivated, never mutated otherwise).
*/
'use strict';
const fs = require('fs');
const path = require('path');

const VERSION = '1.1-draft';
const EFFECTIVE_DATE = '2025-01-01';   // placeholder; counsel sets the real date
const DELIM = '$SS$';

const LEGAL_DIR = path.join(__dirname, '..', 'legal');
const OUT = path.join(__dirname, '..', 'supabase', 'seed', 'seed_policy_versions.sql');

// doc key -> source markdown file (only the five user-facing, addressable docs).
const DOCS = [
  ['tos',       'terms-of-service.md',     'TERMS OF SERVICE'],
  ['privacy',   'privacy-policy.md',       'PRIVACY POLICY'],
  ['curator',   'curator-terms.md',        'CURATOR TERMS'],
  ['copyright', 'copyright-policy.md',     'COPYRIGHT POLICY & TAKEDOWN'],
  ['community', 'community-guidelines.md', 'COMMUNITY GUIDELINES & REPEAT-INFRINGER POLICY'],
];

function read(file) {
  return fs.readFileSync(path.join(LEGAL_DIR, file), 'utf8').replace(/\r\n/g, '\n');
}

const header = `-- ═══════════════════════════════════════════════════════════════
-- seed_policy_versions.sql  (GENERATED — do not hand-edit; see data/_gen_policy_seed.js)
-- SHOWSHAK — BETA CONSENT GATE: publish the (expanded) legal drafts into
-- policy_versions so showshak-legal.html + the consent gate render the real text.
-- ───────────────────────────────────────────────────────────────
-- FOUNDER-RUN, IDEMPOTENT data seed. Apply migration 0031 FIRST (it widens
-- policy_versions.doc to allow 'curator' and creates the consents machinery).
-- Then paste this WHOLE file into the Supabase SQL editor and Run.
--
-- Bodies below are the VERBATIM contents of the legal/*.md drafts at generation
-- time (version '${VERSION}'). They still contain [PLACEHOLDER] tokens (entity,
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
`;

let out = header;

for (const [doc, file, label] of DOCS) {
  let body = read(file);
  if (body.indexOf(DELIM) !== -1) {
    throw new Error('Body for ' + doc + ' contains the SQL delimiter ' + DELIM + ' — choose another tag.');
  }
  out += `
-- ───────────────────────────────────────────────────────────────
-- ${label}  (doc='${doc}' ← legal/${file})
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select '${doc}', '${VERSION}', date '${EFFECTIVE_DATE}',
       ${DELIM}${body}${DELIM}, true
where not exists (select 1 from policy_versions where doc='${doc}' and version='${VERSION}');
`;
}

out += `
-- ───────────────────────────────────────────────────────────────
-- REPOINT is_current → make ONLY version '${VERSION}' current per doc.
-- (Prior version rows are retained for audit; just deactivated.)
-- ───────────────────────────────────────────────────────────────
`;
for (const [doc] of DOCS) {
  out += `update policy_versions set is_current = false where doc='${doc}' and version <> '${VERSION}' and is_current;\n`;
}

out += `
-- Reload PostgREST so reads see the new rows immediately.
notify pgrst, 'reload schema';

-- ── Re-seed recipe for counsel-approved FINAL text ──
--   1. Fill every [PLACEHOLDER] in legal/*.md and have counsel approve.
--   2. Bump VERSION in data/_gen_policy_seed.js (e.g. '1.0'), set EFFECTIVE_DATE.
--   3. node data/_gen_policy_seed.js  → regenerates this file.
--   4. Paste into the Supabase SQL editor and Run (idempotent; repoints is_current).
`;

fs.writeFileSync(OUT, out, 'utf8');
console.log('Wrote ' + OUT + ' (' + out.length + ' bytes) — version ' + VERSION + ', docs: ' + DOCS.map(d => d[0]).join(', '));
