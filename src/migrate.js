'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DIR = path.join(__dirname, '..', 'migrations');

function loadMigrations(dir = DEFAULT_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.js$/.test(f))
    .sort()
    .map((f) => ({ name: f.replace(/\.js$/, ''), file: path.join(dir, f), ...require(path.join(dir, f)) }));
}

function ensureTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
}

function runMigrations(db, dir = DEFAULT_DIR) {
  ensureTable(db);
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  for (const m of loadMigrations(dir)) {
    if (done.has(m.name)) continue;
    db.exec('BEGIN');
    try {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(m.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// Rolls back the most recently applied migration. Throws if it has no down().
function rollbackLast(db, dir = DEFAULT_DIR) {
  ensureTable(db);
  const last = db.prepare('SELECT name FROM schema_migrations ORDER BY applied_at DESC, name DESC LIMIT 1').get();
  if (!last) return null;
  const m = loadMigrations(dir).find((x) => x.name === last.name);
  if (!m || typeof m.down !== 'function') {
    throw new Error(`${last.name} has no down(): it cannot be rolled back`);
  }
  db.exec('BEGIN');
  try {
    m.down(db);
    db.prepare('DELETE FROM schema_migrations WHERE name = ?').run(last.name);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return last.name;
}

module.exports = { runMigrations, rollbackLast, loadMigrations, DEFAULT_DIR };
