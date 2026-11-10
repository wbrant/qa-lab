'use strict';
// Detects: error-200
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('booking validation', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('a booking without an email is rejected with 422 and names the field', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const res = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'validation_failed');
    assert.ok(res.body.fields.email, 'the response must say which field failed');
  });

  test('a rejected booking does not use up a seat', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'not-an-email' });
    const after = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    assert.equal(after.remaining, 3);
  });
});
