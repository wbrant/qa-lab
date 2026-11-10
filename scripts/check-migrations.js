#!/usr/bin/env node
'use strict';
// Pre-deploy risk check for migrations. Exits 1 if any migration (shipped or
// pending) is destructive or cannot be rolled back. Wire it into CI as a gate.
const fs = require('node:fs');
const path = require('node:path');
const { loadMigrations, DEFAULT_DIR } = require('../src/migrate');

const DESTRUCTIVE = /DROP\s+(COLUMN|TABLE)|DELETE\s+FROM|TRUNCATE/i;
const dirs = [DEFAULT_DIR, path.join(DEFAULT_DIR, 'pending')].filter((d) => fs.existsSync(d));

let findings = 0;
for (const dir of dirs) {
  for (const m of loadMigrations(dir)) {
    const label = path.relative(process.cwd(), m.file);
    const problems = [];
    if (typeof m.down !== 'function') problems.push('no down(): cannot be rolled back');
    if (DESTRUCTIVE.test(m.up.toString())) problems.push('up() destroys data (DROP / DELETE / TRUNCATE)');
    if (problems.length) {
      findings++;
      console.log(`RISK  ${label}`);
      for (const p of problems) console.log(`        - ${p}`);
    } else {
      console.log(`ok    ${label}`);
    }
  }
}

if (findings) {
  console.log(`\n${findings} risky migration(s). Block the deploy, or split into an expand step now and a contract step later.`);
  process.exit(1);
}
console.log('\nNo risky migrations found.');
