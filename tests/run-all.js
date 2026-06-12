/* ═══════════════════════════════════════════════════════════════
   tests/run-all.js — plain-Node test runner for the ShowShak v2 suite.
   No framework: discovers every tests/*.test.js, runs each in its own
   `node` process, and exits non-zero if any file fails. This mirrors the
   existing per-file convention (each test file exits non-zero on failure).

   Usage:  npm test     (from the repo root)
           node tests/run-all.js
═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

if (files.length === 0) {
  console.log('No *.test.js files found in tests/.');
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  console.log('\n──────────────────────────────────────────────');
  console.log('running ' + file);
  console.log('──────────────────────────────────────────────');
  const res = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}

console.log('\n══════════════════════════════════════════════');
console.log(failed ? `SUITE FAILED: ${failed}/${files.length} file(s) failed`
                   : `SUITE PASSED: ${files.length} file(s)`);
process.exit(failed ? 1 : 0);
