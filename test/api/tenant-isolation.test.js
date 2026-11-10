'use strict';
// Detects: tenant-leak
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('tenant isolation', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test("tenant A cannot list bookings for tenant B's slot", async () => {
    const yogaSlot = await firstSlot(lab, 'bright-yoga');
    await lab.api('POST', '/api/t/bright-yoga/bookings', { slot_id: yogaSlot.id, name: 'Priya', email: 'priya@example.com' });

    const leak = await lab.api('GET', `/api/t/acme-cuts/slots/${yogaSlot.id}/bookings`);
    assert.equal(leak.status, 404);
    assert.ok(!leak.text.includes('priya@example.com'), 'customer email must not leak across tenants');
  });

  test('a tenant can list bookings for its own slot', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'ada@example.com' });
    const res = await lab.api('GET', `/api/t/acme-cuts/slots/${slot.id}/bookings`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].email, 'ada@example.com');
  });
});
