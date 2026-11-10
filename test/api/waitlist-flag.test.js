'use strict';
// Detects: flag-leak
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('waitlist feature flag', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('the waitlist endpoint is hidden while the flag is off', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 1 });
    const res = await lab.api('POST', `/api/t/acme-cuts/slots/${slot.id}/waitlist`, { email: 'late@example.com' });
    assert.equal(res.status, 404);
  });

  test('the waitlist endpoint works once the flag is on', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 1 });
    await lab.api('POST', '/__admin/flags', { name: 'waitlist', enabled: true });
    const res = await lab.api('POST', `/api/t/acme-cuts/slots/${slot.id}/waitlist`, { email: 'late@example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'waitlisted');
  });
});
