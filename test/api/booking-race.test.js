'use strict';
// Detects: double-booking-race
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('concurrent bookings', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('only one of five simultaneous requests wins the last seat', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 1 });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: `Guest ${i}`, email: `guest${i}@example.com` })
      )
    );
    const created = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.status === 409).length;
    assert.equal(created, 1, `expected exactly 1 booking, got ${created}`);
    assert.equal(full, 4);

    const after = await firstSlot(lab, 'acme-cuts', { capacity: 1 });
    assert.equal(after.remaining, 0, 'remaining seats must never go negative');
  });
});
