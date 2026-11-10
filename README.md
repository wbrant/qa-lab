# qa-lab

**SlotKit** is a small multi-tenant booking app built for demonstrating QA, test automation and AI-assisted testing. It is original code written for teaching. It is not a copy of any employer's product.

It has a toggleable **bug bank**: six planted defects plus one risky migration, each mapped to a real-world testing topic. See [BUGS.md](BUGS.md).

## What is in it

- Multi-tenant accounts (`acme-cuts`, `bright-yoga`) with services, time slots and bookings
- A booking flow with capacity limits, validation and a background reminder job
- Subscription checkout against a **fake** payment gateway with test cards (no network, no real money)
- One feature flag (`waitlist`)
- A migration framework with a pre-deploy risk check
- Zero runtime dependencies: Node 22.13+ only (built-in HTTP server and `node:sqlite`)

## Run it

```bash
npm start                       # http://127.0.0.1:3000
QA_BUGS=error-200 npm start     # with a bug switched on
```

Test cards for the billing page: `4242 4242 4242 4242` succeeds, `4000 0000 0000 3220` needs a 3DS challenge, `4000 0000 0000 0002` is declined.

## Test it

```bash
npm test                 # 21 API tests, bugs off, all green
npm run verify:bugs      # each bug must be caught by its test
npm run check:migrations # exits 1: flags the pending migration

npm install && npx playwright install chromium
npm run e2e              # browser tests
QA_BUGS=3ds-stuck npm run e2e
```

## Lab controls

These endpoints exist for test setup. Disable them with `QA_LAB_ADMIN=off`.

| Endpoint | Purpose |
|---|---|
| `POST /__admin/reset` | Reset the database to seed data |
| `GET /__admin/bugs` / `POST /__admin/bugs` | List or set active bugs |
| `POST /__admin/flags` | `{"name":"waitlist","enabled":true}` |
| `POST /__admin/jobs/run` | Run due background jobs now |

## Layout

```
src/            app, gateway, migrations runner, pages
migrations/     applied migrations; pending/ holds the risky one
test/api/       one regression test per bug, plus smoke tests
test/ai-generated/   an intentionally weak test for review exercises
e2e/            Playwright specs
scripts/        verify-bugs, check-migrations
```
