/* ═══════════════════════════════════════════════════════════════
   tests/prop-onboarding-patch.test.js — Node property test for the
   curator-role-persistence pure onboarding patch builder
   `ssBuildOnboardingPatch(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-onboarding-patch.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a plain object, returns a plain object), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helper's EXACT semantics (mirrored by this test's oracle):
     ssBuildOnboardingPatch(input):
       input = { handle?, bio?, genres?, avatarUrl? }
       - patch is ROLE-FREE: it NEVER contains a `role` key (curator-application-approval
         Task 1.1 — becoming a curator happens ONLY through the admin Approve_RPC, never
         client-side). An empty/blank input therefore yields {} (no keys).
       - username: only when input.handle is a string that, after trim() then
         stripping a SINGLE leading '@' then trim() again, is non-empty. The stored
         value is that cleaned string (no leading '@', no surrounding whitespace).
         NOTE: only ONE leading '@' is stripped, so '@@x' → '@x' (NOT 'x').
       - bio: only when input.bio is a string non-empty after trim(); stored trimmed.
       - genres: only when input.genres is an array of length 1..6; stored as a copy.
       - avatar_url: only when input.avatarUrl is a non-empty string; stored as-is.
       - keys are confined to the allowlist {username, bio, genres, avatar_url};
         no key is ever emitted with an empty/blank value (no overwrite-with-empty).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const ALLOWLIST = ['username', 'bio', 'genres', 'avatar_url'];

/* Inline oracle — an independent re-implementation of the builder's contract.
   Mirrors the exact field rules above; used to check presence/absence + value. */
function expectedPatch(input) {
  var i = (input && typeof input === 'object') ? input : {};
  var patch = {};   // ROLE-FREE — no `role` key
  if (typeof i.handle === 'string') {
    var h = i.handle.trim();
    if (h.charAt(0) === '@') { h = h.slice(1); }  // strip exactly ONE leading '@'
    h = h.trim();
    if (h !== '') { patch.username = h; }
  }
  if (typeof i.bio === 'string') {
    var b = i.bio.trim();
    if (b !== '') { patch.bio = b; }
  }
  if (Array.isArray(i.genres) && i.genres.length >= 1 && i.genres.length <= 6) {
    patch.genres = i.genres.slice();
  }
  if (typeof i.avatarUrl === 'string' && i.avatarUrl !== '') {
    patch.avatar_url = i.avatarUrl;
  }
  return patch;
}

/* A value is a prohibited "empty/blank" patch value when it is an empty STRING
   ('') or an empty ARRAY ([]). NOTE: per the builder's contract, username/bio are
   trimmed (so they can never be whitespace-only when present), while avatar_url is
   an opaque URL kept AS-IS — its only emptiness guard is `!== ''`, so a non-empty
   string like ' ' is a legitimate (if unusual) avatar_url value and is NOT blank. */
function isBlankValue(v) {
  if (typeof v === 'string') { return v === ''; }
  if (Array.isArray(v)) { return v.length === 0; }
  return false;
}

let failed = 0;

console.log('Feature: curator-role-persistence — onboarding patch builder property tests\n');

/* ── Generators (shared by the properties) ────────────────────────────────────
   handle/bio: optional (null) strings, exercising '', whitespace-only, and values
   with one or more leading '@'. genres: arrays of length 0..8 to straddle the 1..6
   inclusion bound. avatarUrl: non-empty strings, '', null, and undefined. */
const handleGen = fc.option(fc.oneof(
  fc.string(),
  fc.string().map((s) => '@' + s),
  fc.string().map((s) => '@@' + s),
  fc.string().map((s) => '  ' + s + '  '),
  fc.constantFrom('', '   ', '\t', '@', '@@', ' @ ', '@neo', '  @neo  ', '  @@x  ')
), { nil: null });

const bioGen = fc.option(fc.oneof(
  fc.string(),
  fc.string().map((s) => '  ' + s + '  '),
  fc.constantFrom('', '   ', '\t\n', 'I review thrillers')
), { nil: null });

const genresGen = fc.array(fc.string(), { maxLength: 8 });

const avatarGen = fc.oneof(
  fc.string({ minLength: 1 }),
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined)
);

const inputGen = fc.record({
  handle: handleGen,
  bio: bioGen,
  genres: genresGen,
  avatarUrl: avatarGen,
});

// Feature: curator-role-persistence, Property 1: Onboarding patch is role-free (never self-promotes)
// **Validates: Requirements 1.5, 5.3 (curator-application-approval); 1.1, 9.2**
try {
  // For ANY input — including {}, null, undefined, and arbitrary objects — the patch
  // NEVER carries a `role` key. Promotion to curator is admin-RPC-only, never client-side.
  const anyInputGen = fc.oneof(
    inputGen,
    fc.constant({}),
    fc.constant(null),
    fc.constant(undefined),
    fc.object(),
    fc.anything()
  );

  fc.assert(fc.property(anyInputGen, (input) => {
    const patch = ss.ssBuildOnboardingPatch(input);
    assert(patch && typeof patch === 'object', 'patch must be an object');
    assert(!('role' in patch),
      `patch must be role-free: got role ${JSON.stringify(patch.role)} for input ${JSON.stringify(input)}`);
    return true;
  }), { numRuns: ITER });

  // Explicit examples — never a role key, and empty input → {} exactly.
  assert(!('role' in ss.ssBuildOnboardingPatch()), 'no-arg → no role');
  assert(!('role' in ss.ssBuildOnboardingPatch(null)), 'null → no role');
  assert(!('role' in ss.ssBuildOnboardingPatch(undefined)), 'undefined → no role');
  assert(JSON.stringify(ss.ssBuildOnboardingPatch({})) === '{}', '{} → empty patch');
  assert(!('role' in ss.ssBuildOnboardingPatch(42)), 'non-object → no role');

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

// Feature: curator-role-persistence, Property 2: Onboarding patch omits empty identity fields and never overwrites with blanks
// **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
try {
  fc.assert(fc.property(inputGen, (input) => {
    const patch = ss.ssBuildOnboardingPatch(input);
    const exp = expectedPatch(input);

    // patch is role-free.
    assert(!('role' in patch), 'patch must be role-free');

    // username: presence + cleaned value match the oracle.
    if ('username' in exp) {
      assert('username' in patch, `username should be present for ${JSON.stringify(input.handle)}`);
      assert(patch.username === exp.username,
        `username mismatch: got ${JSON.stringify(patch.username)} expected ${JSON.stringify(exp.username)}`);
      assert(patch.username === patch.username.trim(), `username must be trimmed: ${JSON.stringify(patch.username)}`);
      assert(patch.username !== '', 'username must not be empty');
    } else {
      assert(!('username' in patch), `username should be ABSENT for ${JSON.stringify(input.handle)} (got ${JSON.stringify(patch.username)})`);
    }

    // bio: presence + trimmed value match the oracle.
    if ('bio' in exp) {
      assert('bio' in patch, `bio should be present for ${JSON.stringify(input.bio)}`);
      assert(patch.bio === exp.bio,
        `bio mismatch: got ${JSON.stringify(patch.bio)} expected ${JSON.stringify(exp.bio)}`);
      assert(patch.bio === patch.bio.trim(), `bio must be trimmed: ${JSON.stringify(patch.bio)}`);
      assert(patch.bio !== '', 'bio must not be empty');
    } else {
      assert(!('bio' in patch), `bio should be ABSENT for ${JSON.stringify(input.bio)} (got ${JSON.stringify(patch.bio)})`);
    }

    // genres: present only for length 1..6, as a copy with identical contents.
    if ('genres' in exp) {
      assert('genres' in patch, `genres should be present for length ${input.genres.length}`);
      assert(Array.isArray(patch.genres), 'genres must be an array');
      assert(patch.genres.length >= 1 && patch.genres.length <= 6,
        `genres length must be 1..6 when present: got ${patch.genres.length}`);
      assert(patch.genres !== input.genres, 'genres must be a COPY, not the same reference');
      assert(JSON.stringify(patch.genres) === JSON.stringify(input.genres),
        `genres contents mismatch: got ${JSON.stringify(patch.genres)} expected ${JSON.stringify(input.genres)}`);
    } else {
      assert(!('genres' in patch),
        `genres should be ABSENT for length ${Array.isArray(input.genres) ? input.genres.length : 'n/a'} (got ${JSON.stringify(patch.genres)})`);
    }

    // avatar_url: present only for a non-empty string, stored as-is.
    if ('avatar_url' in exp) {
      assert('avatar_url' in patch, `avatar_url should be present for ${JSON.stringify(input.avatarUrl)}`);
      assert(patch.avatar_url === exp.avatar_url,
        `avatar_url mismatch: got ${JSON.stringify(patch.avatar_url)} expected ${JSON.stringify(exp.avatar_url)}`);
      assert(patch.avatar_url !== '', 'avatar_url must not be empty');
    } else {
      assert(!('avatar_url' in patch),
        `avatar_url should be ABSENT for ${JSON.stringify(input.avatarUrl)} (got ${JSON.stringify(patch.avatar_url)})`);
    }

    // No key may carry a blank/empty value.
    Object.keys(patch).forEach((k) => {
      assert(!isBlankValue(patch[k]), `key '${k}' must not have a blank value: ${JSON.stringify(patch[k])}`);
    });

    return true;
  }), { numRuns: ITER });

  // ── Explicit boundary / canonical examples ──
  // all-fields present.
  (function () {
    const p = ss.ssBuildOnboardingPatch({
      handle: '  @gpiyush791  ', bio: '  I review thrillers  ',
      genres: ['Thriller', 'Drama'], avatarUrl: 'https://x/avatars/u/1.jpg',
    });
    assert(!('role' in p), 'all-fields must be role-free');
    assert(p.username === 'gpiyush791', `all-fields username: ${p.username}`);
    assert(p.bio === 'I review thrillers', `all-fields bio: ${p.bio}`);
    assert(JSON.stringify(p.genres) === JSON.stringify(['Thriller', 'Drama']), 'all-fields genres');
    assert(p.avatar_url === 'https://x/avatars/u/1.jpg', 'all-fields avatar_url');
  })();

  // bio-only.
  (function () {
    const p = ss.ssBuildOnboardingPatch({ bio: 'I review thrillers' });
    assert(JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['bio']),
      `bio-only keys: ${Object.keys(p)}`);
    assert(p.bio === 'I review thrillers', 'bio-only value');
  })();

  // nothing-entered → {} (empty, role-free).
  (function () {
    const p = ss.ssBuildOnboardingPatch({});
    assert(JSON.stringify(p) === JSON.stringify({}), `nothing-entered: ${JSON.stringify(p)}`);
  })();

  // '@@x' → only ONE '@' stripped → username '@x'.
  (function () {
    const p = ss.ssBuildOnboardingPatch({ handle: '@@x' });
    assert(p.username === '@x', `'@@x' must yield '@x' (only one '@' stripped): got ${JSON.stringify(p.username)}`);
  })();

  // '  @neo  ' → 'neo'.
  (function () {
    const p = ss.ssBuildOnboardingPatch({ handle: '  @neo  ' });
    assert(p.username === 'neo', `'  @neo  ' must yield 'neo': got ${JSON.stringify(p.username)}`);
  })();

  // genres length boundaries: 0 → absent, 1 → present, 6 → present, 7 → absent.
  (function () {
    const g0 = ss.ssBuildOnboardingPatch({ genres: [] });
    assert(!('genres' in g0), 'genres length 0 must be absent');
    const g1 = ss.ssBuildOnboardingPatch({ genres: ['a'] });
    assert('genres' in g1 && g1.genres.length === 1, 'genres length 1 must be present');
    const g6 = ss.ssBuildOnboardingPatch({ genres: ['a', 'b', 'c', 'd', 'e', 'f'] });
    assert('genres' in g6 && g6.genres.length === 6, 'genres length 6 must be present');
    const g7 = ss.ssBuildOnboardingPatch({ genres: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert(!('genres' in g7), 'genres length 7 must be absent');
  })();

  // avatarUrl '' → omitted.
  (function () {
    const p = ss.ssBuildOnboardingPatch({ avatarUrl: '' });
    assert(!('avatar_url' in p), `avatarUrl '' must be omitted: ${JSON.stringify(p)}`);
  })();

  // blank handle / whitespace bio → omitted.
  (function () {
    const p = ss.ssBuildOnboardingPatch({ handle: '   ', bio: '\t\n' });
    assert(!('username' in p), 'whitespace handle must be omitted');
    assert(!('bio' in p), 'whitespace bio must be omitted');
  })();

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

// Feature: curator-role-persistence, Property 3: Onboarding patch keys are confined to the self-update allowlist
// **Validates: Requirements 1.1, 7.2, 7.3**
try {
  const anyInputGen = fc.oneof(
    inputGen,
    fc.constant({}),
    fc.constant(null),
    fc.constant(undefined),
    fc.object(),
    fc.anything()
  );

  fc.assert(fc.property(anyInputGen, (input) => {
    const patch = ss.ssBuildOnboardingPatch(input);
    Object.keys(patch).forEach((k) => {
      assert(ALLOWLIST.indexOf(k) !== -1,
        `key '${k}' is not in the allowlist {${ALLOWLIST.join(', ')}} for input ${JSON.stringify(input)}`);
      assert(!isBlankValue(patch[k]), `key '${k}' must not carry a blank/empty value: ${JSON.stringify(patch[k])}`);
    });
    return true;
  }), { numRuns: ITER });

  // Explicit: a fully-populated patch contains ONLY allowlist keys, none extra.
  (function () {
    const p = ss.ssBuildOnboardingPatch({
      handle: '@neo', bio: 'hi', genres: ['a'], avatarUrl: 'https://x/a.jpg',
    });
    Object.keys(p).forEach((k) => assert(ALLOWLIST.indexOf(k) !== -1, `unexpected key '${k}'`));
  })();

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
