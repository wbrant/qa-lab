'use strict';
const http = require('node:http');
const { openDb, seed } = require('./db');
const { Gateway } = require('./gateway');
const { BUGS, BUG_IDS } = require('./bugs');
const pages = require('./pages');

const PLANS = { starter: 2900, pro: 7900 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

class HttpError extends Error {
  constructor(status, body) {
    super(body.error || 'error');
    this.status = status;
    this.body = body;
  }
}

function parseBugs(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  const ids = list.map((s) => String(s).trim()).filter(Boolean);
  const unknown = ids.filter((id) => !BUG_IDS.includes(id));
  if (unknown.length) throw new Error(`Unknown bug id(s): ${unknown.join(', ')}. Known: ${BUG_IDS.join(', ')}`);
  return new Set(ids);
}

function createApp(opts = {}) {
  const state = {
    bugs: parseBugs(opts.bugs ?? process.env.QA_BUGS),
    admin: opts.admin ?? process.env.QA_LAB_ADMIN !== 'off',
    db: null,
    gateway: null,
    server: null,
    timer: null,
  };
  const has = (id) => state.bugs.has(id);
  const db = () => state.db;

  function reset() {
    if (state.db) state.db.close();
    state.db = openDb();
    seed(state.db);
    state.gateway = new Gateway();
  }
  reset();

  // ---- helpers -----------------------------------------------------------
  const invalid = (fields) =>
    // BUG error-200: validation failures are reported with a success status.
    [has('error-200') ? 200 : 422, { error: 'validation_failed', fields }];

  function tenantOr404(slug) {
    const t = db().prepare('SELECT id, slug, name, plan, subscription_status FROM tenants WHERE slug = ?').get(slug);
    if (!t) throw new HttpError(404, { error: 'tenant_not_found' });
    return t;
  }

  const flagOn = (name) => Boolean(db().prepare('SELECT enabled FROM flags WHERE name = ?').get(name)?.enabled);

  function processJobs() {
    const due = db().prepare("SELECT * FROM jobs WHERE status = 'pending' AND run_at <= ? ORDER BY id").all(Date.now());
    for (const job of due) {
      const payload = JSON.parse(job.payload);
      if (job.kind === 'reminder') {
        db().prepare("UPDATE bookings SET reminder_status = 'sent' WHERE id = ?").run(payload.booking_id);
      }
      db().prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
    }
    return due.length;
  }

  function slotsFor(tenantId) {
    return db()
      .prepare(
        `SELECT s.id, s.starts_at, s.capacity, sv.name AS service, sv.price_cents,
                s.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS remaining
           FROM slots s JOIN services sv ON sv.id = s.service_id
          WHERE s.tenant_id = ? ORDER BY s.starts_at`
      )
      .all(tenantId);
  }

  // ---- routes ------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, handler) =>
    routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, admin: pattern.startsWith('/__admin') });

  // Pages
  route('GET', '/', () => [200, pages.home(db().prepare('SELECT slug, name FROM tenants ORDER BY id').all()), 'text/html']);
  route('GET', '/t/:slug', ({ params }) => {
    const t = tenantOr404(params.slug);
    return [200, pages.tenantPage(t, slotsFor(t.id)), 'text/html'];
  });
  route('GET', '/t/:slug/book/:slotId', ({ params }) => {
    const t = tenantOr404(params.slug);
    const slot = slotsFor(t.id).find((s) => s.id === Number(params.slotId));
    if (!slot) throw new HttpError(404, { error: 'slot_not_found' });
    return [200, pages.bookPage(t, slot), 'text/html'];
  });
  route('GET', '/t/:slug/billing', ({ params }) => [200, pages.billingPage(tenantOr404(params.slug)), 'text/html']);

  // Tenants
  route('POST', '/api/tenants', ({ body }) => {
    const name = String(body.name || '').trim();
    const slug = String(body.slug || '').trim();
    const fields = {};
    if (!name) fields.name = 'required';
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) fields.slug = 'must be 3-30 chars of a-z, 0-9 or -';
    if (Object.keys(fields).length) return invalid(fields);
    if (db().prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) return [409, { error: 'slug_taken' }];
    const r = db().prepare('INSERT INTO tenants (slug, name) VALUES (?, ?)').run(slug, name);
    return [201, { id: Number(r.lastInsertRowid), slug, name, plan: 'free', subscription_status: 'none' }];
  });
  route('GET', '/api/t/:slug', ({ params }) => [200, tenantOr404(params.slug)]);

  // Slots
  route('GET', '/api/t/:slug/slots', ({ params }) => [200, slotsFor(tenantOr404(params.slug).id)]);

  // Bookings
  route('POST', '/api/t/:slug/bookings', async ({ params, body }) => {
    const t = tenantOr404(params.slug);
    const fields = {};
    if (!String(body.name || '').trim()) fields.name = 'required';
    if (!/^\S+@\S+\.\S+$/.test(String(body.email || ''))) fields.email = 'invalid';
    if (!Number.isInteger(body.slot_id)) fields.slot_id = 'required';
    if (Object.keys(fields).length) return invalid(fields);

    const slot = db().prepare('SELECT id, capacity FROM slots WHERE id = ? AND tenant_id = ?').get(body.slot_id, t.id);
    if (!slot) return [404, { error: 'slot_not_found' }];

    const taken = () => db().prepare("SELECT COUNT(*) AS c FROM bookings WHERE slot_id = ? AND status = 'confirmed'").get(slot.id).c;
    if (taken() >= slot.capacity) return [409, { error: 'slot_full' }];

    // BUG double-booking-race: yielding between the capacity check and the insert
    // lets concurrent requests all pass the check. Without the bug there is no
    // await between check and insert, so the pair runs atomically.
    if (has('double-booking-race')) await sleep(rand(20, 40));

    const r = db()
      .prepare("INSERT INTO bookings (tenant_id, slot_id, customer_name, customer_email, status, reminder_status) VALUES (?, ?, ?, ?, 'confirmed', 'queued')")
      .run(t.id, slot.id, String(body.name).trim(), String(body.email));
    const bookingId = Number(r.lastInsertRowid);

    // BUG slow-job: the reminder becomes due after a random delay instead of immediately.
    const runAt = Date.now() + (has('slow-job') ? rand(150, 700) : 0);
    db().prepare("INSERT INTO jobs (kind, payload, run_at) VALUES ('reminder', ?, ?)").run(JSON.stringify({ booking_id: bookingId }), runAt);

    return [201, { id: bookingId, status: 'confirmed', reminder_status: 'queued' }];
  });

  route('GET', '/api/t/:slug/bookings/:id', ({ params }) => {
    const t = tenantOr404(params.slug);
    const b = db()
      .prepare('SELECT id, slot_id, customer_name AS name, customer_email AS email, status, reminder_status FROM bookings WHERE id = ? AND tenant_id = ?')
      .get(Number(params.id), t.id);
    if (!b) return [404, { error: 'not_found' }];
    return [200, b];
  });

  route('GET', '/api/t/:slug/slots/:slotId/bookings', ({ params }) => {
    const t = tenantOr404(params.slug);
    // BUG tenant-leak: the ownership check on the slot is skipped, so any slot id
    // works under any tenant slug.
    if (!has('tenant-leak')) {
      const owned = db().prepare('SELECT 1 FROM slots WHERE id = ? AND tenant_id = ?').get(Number(params.slotId), t.id);
      if (!owned) return [404, { error: 'slot_not_found' }];
    }
    const rows = db()
      .prepare("SELECT id, customer_name AS name, customer_email AS email, status FROM bookings WHERE slot_id = ? ORDER BY id")
      .all(Number(params.slotId));
    return [200, rows];
  });

  // Waitlist (behind the "waitlist" feature flag)
  route('POST', '/api/t/:slug/slots/:slotId/waitlist', ({ params, body }) => {
    const t = tenantOr404(params.slug);
    // BUG flag-leak: the flag check is skipped.
    if (!flagOn('waitlist') && !has('flag-leak')) return [404, { error: 'not_found' }];
    if (!/^\S+@\S+\.\S+$/.test(String(body.email || ''))) return invalid({ email: 'invalid' });
    const slot = db().prepare('SELECT id FROM slots WHERE id = ? AND tenant_id = ?').get(Number(params.slotId), t.id);
    if (!slot) return [404, { error: 'slot_not_found' }];
    db().prepare('INSERT INTO waitlist (tenant_id, slot_id, email) VALUES (?, ?, ?)').run(t.id, slot.id, String(body.email));
    return [201, { status: 'waitlisted' }];
  });

  // Subscriptions
  route('POST', '/api/t/:slug/subscribe', ({ params, body }) => {
    const t = tenantOr404(params.slug);
    const amount = PLANS[body.plan];
    if (!amount) return invalid({ plan: `must be one of ${Object.keys(PLANS).join(', ')}` });
    const intent = state.gateway.createIntent({ amount, card: body.card });
    const addPayment = (status) =>
      db().prepare('INSERT INTO payments (tenant_id, kind, amount_cents, status, intent_id, plan) VALUES (?, ?, ?, ?, ?, ?)').run(t.id, 'subscription', amount, status, intent.id, body.plan);

    if (intent.status === 'succeeded') {
      addPayment('succeeded');
      db().prepare("UPDATE tenants SET plan = ?, subscription_status = 'active' WHERE id = ?").run(body.plan, t.id);
      return [200, { status: 'active', plan: body.plan }];
    }
    if (intent.status === 'requires_action') {
      addPayment('requires_action');
      db().prepare("UPDATE tenants SET subscription_status = 'pending_action' WHERE id = ?").run(t.id);
      return [202, { status: 'requires_action', intent_id: intent.id }];
    }
    addPayment('failed');
    return [402, { error: intent.error }];
  });

  route('POST', '/api/t/:slug/subscribe/complete', ({ params, body }) => {
    const t = tenantOr404(params.slug);
    const payment = db().prepare("SELECT * FROM payments WHERE intent_id = ? AND tenant_id = ? AND status = 'requires_action'").get(String(body.intent_id || ''), t.id);
    if (!payment) return [404, { error: 'intent_not_found' }];
    const result = state.gateway.completeAuthentication(payment.intent_id, body.result);
    if (result && result.status === 'succeeded') {
      db().prepare("UPDATE payments SET status = 'succeeded' WHERE id = ?").run(payment.id);
      // BUG 3ds-stuck: the tenant is never activated after the challenge passes,
      // yet the response below still claims success.
      if (!has('3ds-stuck')) {
        db().prepare("UPDATE tenants SET plan = ?, subscription_status = 'active' WHERE id = ?").run(payment.plan, t.id);
      }
      return [200, { status: 'active', plan: payment.plan }];
    }
    db().prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(payment.id);
    db().prepare("UPDATE tenants SET subscription_status = 'none' WHERE id = ?").run(t.id);
    return [402, { error: result?.error || 'authentication_failed' }];
  });

  // Admin / lab controls (turn off with QA_LAB_ADMIN=off)
  route('POST', '/__admin/reset', () => {
    reset();
    return [200, { status: 'reset' }];
  });
  route('GET', '/__admin/bugs', () => [200, { available: BUGS, active: [...state.bugs] }]);
  route('POST', '/__admin/bugs', ({ body }) => {
    try {
      state.bugs = parseBugs(body.bugs ?? []);
    } catch (err) {
      return [422, { error: 'unknown_bug', message: err.message }];
    }
    return [200, { active: [...state.bugs] }];
  });
  route('POST', '/__admin/flags', ({ body }) => {
    if (!body.name) return [422, { error: 'validation_failed', fields: { name: 'required' } }];
    db().prepare('INSERT INTO flags (name, enabled) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled').run(String(body.name), body.enabled ? 1 : 0);
    return [200, { name: body.name, enabled: Boolean(body.enabled) }];
  });
  route('POST', '/__admin/jobs/run', () => [200, { processed: processJobs() }]);

  // ---- server ------------------------------------------------------------
  async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, { error: 'invalid_json' });
    }
  }

  function send(res, status, payload, type) {
    const isHtml = type === 'text/html';
    res.writeHead(status, { 'content-type': isHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8' });
    res.end(isHtml ? payload : JSON.stringify(payload));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      if (r.admin && !state.admin) break;
      try {
        const body = req.method === 'GET' ? {} : await readJson(req);
        const [status, payload, type] = await r.handler({ params: m.groups || {}, body, url });
        return send(res, status, payload, type);
      } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, err.body);
        console.error(err);
        return send(res, 500, { error: 'internal_error' });
      }
    }
    return send(res, 404, { error: 'not_found' });
  }

  function listen(port = 0, { worker = false } = {}) {
    state.server = http.createServer((req, res) => {
      handle(req, res);
    });
    if (worker) state.timer = setInterval(() => processJobs(), 100).unref();
    return new Promise((resolve) => state.server.listen(port, '127.0.0.1', () => resolve(state.server)));
  }

  function close() {
    if (state.timer) clearInterval(state.timer);
    return new Promise((resolve) => {
      if (!state.server) return resolve();
      state.server.closeAllConnections?.();
      state.server.close(() => resolve());
    });
  }

  return { state, listen, close, processJobs };
}

module.exports = { createApp };
