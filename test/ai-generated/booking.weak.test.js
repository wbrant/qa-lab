'use strict';
// A realistic example of a test an AI assistant might write: it is green, it
// looks reasonable, and it proves almost nothing.
//
// Both tests below pass whether the app is correct (422) or broken (200 with an
// error body), because they only assert "the server did not crash".
// The strong versions live in test/api/validation.test.js. Compare the two when
// you review AI-generated tests: ask "what failure would make this go red?"
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('booking validation (WEAK, AI-generated style)', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('booking without email is handled', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const res = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada' });
    assert.ok(res.status < 500);
    assert.ok(res.body);
  });

  test('booking with invalid email returns a response', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const res = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'nope' });
    assert.notEqual(res.status, 500);
  });
});
