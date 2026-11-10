'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('smoke', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('home page lists the seeded tenants', async () => {
    const res = await lab.api('GET', '/');
    assert.equal(res.status, 200);
    assert.match(res.text, /Acme Cuts/);
    assert.match(res.text, /Bright Yoga/);
  });

  test('a guest can book an open slot and the slot count drops', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const res = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'ada@example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'confirmed');
    const after = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    assert.equal(after.remaining, 2);
  });

  test('a full slot rejects the next booking', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 1 });
    const first = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'ada@example.com' });
    const second = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Bo', email: 'bo@example.com' });
    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(second.body.error, 'slot_full');
  });

  test('new tenants can be created, and slugs are unique', async () => {
    const ok = await lab.api('POST', '/api/tenants', { name: 'Zen Dojo', slug: 'zen-dojo' });
    assert.equal(ok.status, 201);
    const dup = await lab.api('POST', '/api/tenants', { name: 'Zen Dojo 2', slug: 'zen-dojo' });
    assert.equal(dup.status, 409);
  });

  test('a booking is only visible under its own tenant', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const made = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'ada@example.com' });
    const own = await lab.api('GET', `/api/t/acme-cuts/bookings/${made.body.id}`);
    const other = await lab.api('GET', `/api/t/bright-yoga/bookings/${made.body.id}`);
    assert.equal(own.status, 200);
    assert.equal(other.status, 404);
  });
});
