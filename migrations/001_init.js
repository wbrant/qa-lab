'use strict';

exports.up = (db) => {
  db.exec(`
    CREATE TABLE tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'none',
      legacy_contact TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      price_cents INTEGER NOT NULL
    );
    CREATE TABLE slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      starts_at TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      slot_id INTEGER NOT NULL REFERENCES slots(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

exports.down = (db) => {
  db.exec('DROP TABLE bookings; DROP TABLE slots; DROP TABLE services; DROP TABLE tenants;');
};
