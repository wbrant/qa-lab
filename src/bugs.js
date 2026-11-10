'use strict';

// The bug bank. Each bug is OFF by default and switched on with QA_BUGS=id1,id2
// or at runtime with POST /__admin/bugs {"bugs": ["id1"]}.
const BUGS = [
  {
    id: 'double-booking-race',
    title: 'Concurrent bookings oversell a slot',
    topic: 'Flaky tests and race conditions',
    symptom: 'Two or more people book the last spot when requests arrive together.',
  },
  {
    id: 'tenant-leak',
    title: 'Bookings of one tenant readable through another tenant URL',
    topic: 'Multi-tenant isolation (IDOR)',
    symptom: 'GET /api/t/acme-cuts/slots/<bright-yoga slot id>/bookings returns customer emails.',
  },
  {
    id: '3ds-stuck',
    title: 'Subscription stays pending after a successful 3DS challenge',
    topic: 'Payments testing (3DS)',
    symptom: 'API says "active" but the account never leaves pending_action.',
  },
  {
    id: 'slow-job',
    title: 'Reminder job runs after a random delay',
    topic: 'Async work and timing-based flakiness',
    symptom: 'Tests that drain the queue once and assert immediately pass or fail at random.',
  },
  {
    id: 'error-200',
    title: 'Validation errors come back as HTTP 200',
    topic: 'Reviewing AI-written tests (status-only assertions)',
    symptom: 'UI shows "Booking #undefined confirmed"; weak tests that only check status still pass.',
  },
  {
    id: 'flag-leak',
    title: 'Waitlist endpoint works even with the feature flag off',
    topic: 'Testing behind feature flags',
    symptom: 'POST /waitlist returns 201 while the waitlist flag is disabled.',
  },
];

module.exports = { BUGS, BUG_IDS: BUGS.map((b) => b.id) };
