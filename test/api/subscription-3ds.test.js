'use strict';
// Detects: 3ds-stuck
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startLab } = require('../helpers');

const SUCCESS = '4242 4242 4242 4242';
const NEEDS_3DS = '4000 0000 0000 3220';
const DECLINED = '4000 0000 0000 0002';

describe('subscriptions', () => {
  let lab;
  beforeEach(async () => { lab = await startLab(); });
  afterEach(() => lab.close());

  const tenant = async () => (await lab.api('GET', '/api/t/acme-cuts')).body;

  test('a normal card activates the plan immediately', async () => {
    const res = await lab.api('POST', '/api/t/acme-cuts/subscribe', { plan: 'pro', card: SUCCESS });
    assert.equal(res.status, 200);
    const t = await tenant();
    assert.equal(t.plan, 'pro');
    assert.equal(t.subscription_status, 'active');
  });

  test('a declined card leaves the account untouched', async () => {
    const res = await lab.api('POST', '/api/t/acme-cuts/subscribe', { plan: 'pro', card: DECLINED });
    assert.equal(res.status, 402);
    assert.equal(res.body.error, 'card_declined');
    const t = await tenant();
    assert.equal(t.plan, 'free');
    assert.equal(t.subscription_status, 'none');
  });

  test('a 3DS card waits, then activates once the challenge passes', async () => {
    const start = await lab.api('POST', '/api/t/acme-cuts/subscribe', { plan: 'pro', card: NEEDS_3DS });
    assert.equal(start.status, 202);
    assert.equal((await tenant()).subscription_status, 'pending_action');

    const done = await lab.api('POST', '/api/t/acme-cuts/subscribe/complete', { intent_id: start.body.intent_id, result: 'pass' });
    assert.equal(done.status, 200);

    const t = await tenant();
    assert.equal(t.subscription_status, 'active', 'API said active, so the account must be active');
    assert.equal(t.plan, 'pro');
  });

  test('a failed 3DS challenge does not activate the plan', async () => {
    const start = await lab.api('POST', '/api/t/acme-cuts/subscribe', { plan: 'starter', card: NEEDS_3DS });
    const done = await lab.api('POST', '/api/t/acme-cuts/subscribe/complete', { intent_id: start.body.intent_id, result: 'fail' });
    assert.equal(done.status, 402);
    const t = await tenant();
    assert.equal(t.subscription_status, 'none');
    assert.equal(t.plan, 'free');
  });
});
