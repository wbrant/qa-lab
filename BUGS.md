# Bug bank

Every bug is **off by default**. Turn bugs on with an environment variable or at runtime:

```bash
QA_BUGS=error-200,3ds-stuck npm start
curl -X POST localhost:3000/__admin/bugs -H 'content-type: application/json' -d '{"bugs":["tenant-leak"]}'
curl localhost:3000/__admin/bugs          # lists all bugs and which are active
```

`npm run verify:bugs` proves each bug is real: its regression test passes with the bug off and fails with it on.

| Bug id | What goes wrong | Where it lives | Caught by | Video topic |
|---|---|---|---|---|
| `double-booking-race` | Concurrent requests all pass the capacity check, then all insert | `POST /bookings` in `src/app.js` | `test/api/booking-race.test.js` | Flaky tests and race conditions |
| `tenant-leak` | Slot ownership check skipped, so one tenant reads another tenant's customer emails | `GET /slots/:id/bookings` | `test/api/tenant-isolation.test.js` | Multi-tenant isolation |
| `3ds-stuck` | After a passed 3DS challenge the API says "active" but the account stays `pending_action` | `POST /subscribe/complete` | `test/api/subscription-3ds.test.js`, `e2e/billing.spec.js` | Payments testing: 3DS |
| `slow-job` | Reminder job becomes due after a random 150-700 ms delay | `POST /bookings` (job enqueue) | `test/api/reminders.test.js` | Async work and timing flakiness |
| `error-200` | Validation errors return HTTP 200 with an error body | `invalid()` in `src/app.js` | `test/api/validation.test.js`, `e2e/booking.spec.js` | Reviewing AI-written tests |
| `flag-leak` | Waitlist endpoint ignores the feature flag | `POST /slots/:id/waitlist` | `test/api/waitlist-flag.test.js` | Testing behind feature flags |
| *(migration)* | `migrations/pending/003_drop_legacy_contact.js` drops a column and has no `down()` | `migrations/pending/` | `npm run check:migrations` | Pre-deploy risk checks |

## Notes per bug

**double-booking-race.** The bug is a pause between "is there room?" and "insert". The fixed path has no `await` between the two, so the pair is atomic. In a real app the fix is a transaction plus a unique or capacity constraint. Detection is reliable here because the pause is 20-40 ms; real races are rarer, which is why they show up as flaky tests.

**slow-job.** The test drains the queue once and asserts immediately. With the bug it is not due yet. Fixes: poll with a timeout, or inject a fake clock. Do not add a `sleep`.

**error-200 and the weak AI-style tests.** `test/ai-generated/booking.weak.test.js` is a green test that asserts only `status < 500` and that a body exists. It passes with the bug on and off. Run it next to `test/api/validation.test.js` and ask of each assertion: *what failure would turn this red?*

**3ds-stuck.** The response claims success, so an API-only check on the response passes. You have to read the account back. The Playwright spec reloads the page for the same reason.

**The migration.** The PR diff is one line. Run `npm run check:migrations` to see it blocked, then discuss the expand-then-contract alternative: stop reading the column, ship, and drop it a release later.
