/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-identity.test.js — Node property test for the
   public-curator-profile pure view-model resolver
   `ssResolveCuratorViewModel(usersRow, contentRows, followerCount)`
   in showshak-shared.js. This file focuses on the IDENTITY fields of the
   resolved profile when the row's role === 'curator'.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-identity.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared
   DOM/window stub (tests/_pbt.js) BEFORE requiring it. The helper under test
   is PURE (takes plain objects/arrays/numbers), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   IDENTITY semantics mirrored by this test's oracle (role === 'curator'):
     found    → true
     name     → row.name when a non-empty string, else row.username
     handle   → '@' + row.username
     photo    → row.avatar_url when a non-empty string, else null
     letter   → uppercased first char of (non-empty name else username)
     bio      → row.bio when a non-empty string, else ''
     genres   → row.genres when a non-empty array, else []
     verified → !!row.verified
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function nonEmptyStr(v) { return (typeof v === 'string' && v.length > 0) ? v : null; }

let failed = 0;

console.log('Feature: public-curator-profile — resolved curator identity property test\n');

// Feature: public-curator-profile, Property 2: Resolved identity reflects the real users row with safe fallbacks
// **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 7.1, 12.4**
try {
  // A valid handle is always a non-empty alphanumeric username.
  const usernameGen = fc.array(
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('')),
    { minLength: 1, maxLength: 24 }
  ).map((chars) => chars.join(''));

  // Optional string fields cover the empty string ('') and absence (undefined).
  const optStr = fc.option(fc.string(), { nil: undefined });
  const optGenres = fc.option(fc.array(fc.string()), { nil: undefined });

  const rowGen = fc.record({
    role: fc.constant('curator'),
    username: usernameGen,
    name: optStr,
    avatar_url: optStr,
    bio: optStr,
    genres: optGenres,
    verified: fc.boolean(),
  });

  fc.assert(fc.property(rowGen, (row) => {
    const result = ss.ssResolveCuratorViewModel(row, [], 0);

    assert(result && result.found === true, 'curator row must resolve found=true');
    const p = result.profile;
    assert(p && typeof p === 'object', 'profile must be an object for a curator row');

    // name: non-empty row.name else username (Req 2.1, 2.8).
    const expectedName = nonEmptyStr(row.name) != null ? row.name : row.username;
    assert(p.name === expectedName,
      `name mismatch: got ${JSON.stringify(p.name)} expected ${JSON.stringify(expectedName)}`);

    // handle: '@' + username (Req 2.2).
    assert(p.handle === '@' + row.username,
      `handle mismatch: got ${JSON.stringify(p.handle)} expected ${JSON.stringify('@' + row.username)}`);

    // photo: non-empty avatar_url else null (Req 2.3, 2.4).
    const expectedPhoto = nonEmptyStr(row.avatar_url) != null ? row.avatar_url : null;
    assert(p.photo === expectedPhoto,
      `photo mismatch: got ${JSON.stringify(p.photo)} expected ${JSON.stringify(expectedPhoto)}`);

    // letter: uppercased first char of (non-empty name else username) (Req 2.4).
    const letterSrc = nonEmptyStr(row.name) != null ? row.name : row.username;
    const expectedLetter = letterSrc.charAt(0).toUpperCase();
    assert(p.letter === expectedLetter,
      `letter mismatch: got ${JSON.stringify(p.letter)} expected ${JSON.stringify(expectedLetter)}`);

    // bio: non-empty row.bio else '' (Req 2.5, 2.9).
    const expectedBio = nonEmptyStr(row.bio) != null ? row.bio : '';
    assert(p.bio === expectedBio,
      `bio mismatch: got ${JSON.stringify(p.bio)} expected ${JSON.stringify(expectedBio)}`);

    // genres: non-empty array else [] (Req 2.7, 2.10).
    if (Array.isArray(row.genres) && row.genres.length) {
      assert(p.genres === row.genres,
        'genres should be the same non-empty array reference from the row');
    } else {
      assert(Array.isArray(p.genres) && p.genres.length === 0,
        `genres should be [] when row.genres is empty/absent: got ${JSON.stringify(p.genres)}`);
    }

    // verified: boolean coercion (Req 2.6).
    assert(p.verified === !!row.verified,
      `verified mismatch: got ${JSON.stringify(p.verified)} expected ${!!row.verified}`);

    // No-mock-placeholder guarantee: identity derives from the generated row, which
    // random generation makes statistically impossible to collide with fixed mocks.
    // We assert the derivation directly (handle is '@'+username; name is row-derived).
    assert(p.handle.slice(1) === row.username, 'handle must derive from the row username');
    assert(p.name === row.name || p.name === row.username,
      'name must derive from the row name/username, never a placeholder');

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: empty name → username fallback; empty avatar_url → null photo ──
  const ex1 = ss.ssResolveCuratorViewModel(
    { role: 'curator', username: 'ava', name: '', avatar_url: '', bio: '', genres: [], verified: true },
    [], 7
  );
  assert(ex1.found === true, 'ex1 should be found');
  assert(ex1.profile.name === 'ava', `ex1 empty name should fall back to username: got ${ex1.profile.name}`);
  assert(ex1.profile.handle === '@ava', `ex1 handle: got ${ex1.profile.handle}`);
  assert(ex1.profile.photo === null, `ex1 empty avatar_url should yield null photo: got ${ex1.profile.photo}`);
  assert(ex1.profile.letter === 'A', `ex1 letter from username: got ${ex1.profile.letter}`);
  assert(ex1.profile.bio === '', `ex1 empty bio should be '': got ${ex1.profile.bio}`);
  assert(Array.isArray(ex1.profile.genres) && ex1.profile.genres.length === 0, 'ex1 empty genres → []');
  assert(ex1.profile.verified === true, 'ex1 verified true');

  // ── Explicit example: present name/avatar_url are reflected as-is ──
  const ex2 = ss.ssResolveCuratorViewModel(
    { role: 'curator', username: 'neo', name: 'Neo Anderson', avatar_url: 'https://cdn/x.jpg',
      bio: 'film nerd', genres: ['Sci-Fi'], verified: false },
    [], 0
  );
  assert(ex2.profile.name === 'Neo Anderson', `ex2 name should reflect row.name: got ${ex2.profile.name}`);
  assert(ex2.profile.handle === '@neo', `ex2 handle: got ${ex2.profile.handle}`);
  assert(ex2.profile.photo === 'https://cdn/x.jpg', `ex2 photo should reflect avatar_url: got ${ex2.profile.photo}`);
  assert(ex2.profile.letter === 'N', `ex2 letter from name: got ${ex2.profile.letter}`);
  assert(ex2.profile.bio === 'film nerd', `ex2 bio: got ${ex2.profile.bio}`);
  assert(ex2.profile.genres.length === 1 && ex2.profile.genres[0] === 'Sci-Fi', 'ex2 genres reflected');
  assert(ex2.profile.verified === false, 'ex2 verified false');

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
