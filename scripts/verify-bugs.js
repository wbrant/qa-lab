#!/usr/bin/env node
'use strict';
// Proves the bug bank works: for every bug, its regression test must PASS with
// the bug off and FAIL with the bug on. Also checks the weak AI-style test stays
// green with error-200 enabled (that is the point of it), and that the
// migration checker flags the pending migration.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cases = [
  ['double-booking-race', 'test/api/booking-race.test.js'],
  ['tenant-leak', 'test/api/tenant-isolation.test.js'],
  ['3ds-stuck', 'test/api/subscription-3ds.test.js'],
  ['slow-job', 'test/api/reminders.test.js'],
  ['error-200', 'test/api/validation.test.js'],
  ['flag-leak', 'test/api/waitlist-flag.test.js'],
];

function runTest(file, bugs) {
  const r = spawnSync(process.execPath, ['--test', file], {
    cwd: root,
    env: { ...process.env, QA_BUGS: bugs },
    encoding: 'utf8',
  });
  return r.status;
}

let failures = 0;
const rows = [];
const mark = (ok) => (ok ? 'ok' : 'WRONG');

for (const [bug, file] of cases) {
  const clean = runTest(file, '') === 0;
  const caught = runTest(file, bug) !== 0;
  if (!clean || !caught) failures++;
  rows.push([bug, `passes without bug: ${mark(clean)}`, `fails with bug: ${mark(caught)}`]);
}

const weakStaysGreen = runTest('test/ai-generated/booking.weak.test.js', 'error-200') === 0;
if (!weakStaysGreen) failures++;
rows.push(['error-200', 'weak AI-style test stays green', mark(weakStaysGreen)]);

const checker = spawnSync(process.execPath, ['scripts/check-migrations.js'], { cwd: root, encoding: 'utf8' });
const flagged = checker.status !== 0;
if (!flagged) failures++;
rows.push(['unrollbackable-migration', 'check:migrations exits non-zero', mark(flagged)]);

for (const row of rows) console.log(row[0].padEnd(26), row[1].padEnd(36), row[2]);
console.log(failures === 0 ? '\nAll bugs behave as designed.' : `\n${failures} check(s) did not behave as designed.`);
process.exit(failures === 0 ? 0 : 1);
