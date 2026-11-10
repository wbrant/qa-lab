'use strict';
// Detects: slow-job
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab, firstSlot } = require('../helpers');

describe('booking reminders', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  test('a reminder is queued, then sent when the job queue runs', async () => {
    const slot = await firstSlot(lab, 'acme-cuts', { capacity: 3 });
    const made = await lab.api('POST', '/api/t/acme-cuts/bookings', { slot_id: slot.id, name: 'Ada', email: 'ada@example.com' });
    const id = made.body.id;

    assert.equal((await lab.api('GET', `/api/t/acme-cuts/bookings/${id}`)).body.reminder_status, 'queued');

    await lab.api('POST', '/__admin/jobs/run');

    // Deliberately a single drain followed by an immediate assert: with the
    // slow-job bug the reminder is not due yet, so this passes or fails by timing.
    const after = await lab.api('GET', `/api/t/acme-cuts/bookings/${id}`);
    assert.equal(after.body.reminder_status, 'sent');
  });
});
