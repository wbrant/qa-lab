'use strict';
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('./migrate');

// Always in-memory: the lab resets in milliseconds and tests never share state.
function openDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  return db;
}

// Deterministic demo data. Dates are fixed so tests never depend on "today".
function seed(db) {
  const tenant = db.prepare('INSERT INTO tenants (slug, name, legacy_contact) VALUES (?, ?, ?)');
  const service = db.prepare('INSERT INTO services (tenant_id, name, duration_min, price_cents) VALUES (?, ?, ?, ?)');
  const slot = db.prepare('INSERT INTO slots (tenant_id, service_id, starts_at, capacity) VALUES (?, ?, ?, ?)');

  const acme = Number(tenant.run('acme-cuts', 'Acme Cuts', 'Pat (555-0100)').lastInsertRowid);
  const haircut = Number(service.run(acme, 'Haircut', 30, 3500).lastInsertRowid);
  slot.run(acme, haircut, '2030-01-15T09:00', 1); // single seat: used by the race test
  slot.run(acme, haircut, '2030-01-15T10:00', 1);
  slot.run(acme, haircut, '2030-01-15T11:00', 3);

  const yoga = Number(tenant.run('bright-yoga', 'Bright Yoga', null).lastInsertRowid);
  const vinyasa = Number(service.run(yoga, 'Vinyasa Flow', 60, 1800).lastInsertRowid);
  slot.run(yoga, vinyasa, '2030-01-16T07:00', 10);
  slot.run(yoga, vinyasa, '2030-01-16T18:00', 10);

  db.prepare('INSERT INTO flags (name, enabled) VALUES (?, 0)').run('waitlist');
}

module.exports = { openDb, seed };
