'use strict';

exports.up = (db) => {
  db.exec(`
    ALTER TABLE bookings ADD COLUMN reminder_status TEXT NOT NULL DEFAULT 'none';
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      plan TEXT
    );
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      run_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE flags (
      name TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      slot_id INTEGER NOT NULL REFERENCES slots(id),
      email TEXT NOT NULL
    );
  `);
};

exports.down = (db) => {
  db.exec('DROP TABLE waitlist; DROP TABLE flags; DROP TABLE jobs; DROP TABLE payments;');
  db.exec('ALTER TABLE bookings DROP COLUMN reminder_status;');
};
