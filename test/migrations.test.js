'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations, rollbackLast } = require('../src/migrate');

const PENDING = path.join(__dirname, '..', 'migrations', 'pending');

function freshDb() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  return db;
}

test('the shipped migrations apply cleanly and 002 rolls back', () => {
  const db = freshDb();
  assert.equal(rollbackLast(db), '002_payments_jobs_flags');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  assert.ok(!tables.includes('jobs'));
  assert.ok(tables.includes('bookings'));
});

test('the pending cleanup migration destroys data and cannot be rolled back', () => {
  const db = freshDb();
  db.prepare("INSERT INTO tenants (slug, name, legacy_contact) VALUES ('t1', 'T1', 'Pat (555-0100)')").run();

  runMigrations(db, PENDING);

  const cols = db.prepare('PRAGMA table_info(tenants)').all().map((c) => c.name);
  assert.ok(!cols.includes('legacy_contact'), 'column is gone, and so is its data');
  assert.throws(() => rollbackLast(db, PENDING), /no down\(\)/);
});
