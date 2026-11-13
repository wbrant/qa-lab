'use strict';

// Server-rendered pages. The look is for demo videos only. Tests rely on the
// labels, button names, ids, and data-slot-id rows, so keep those stable.

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// Each tenant gets its own accent color, so cross-tenant bugs are easy to spot on screen.
const ACCENTS = { 'acme-cuts': '#3b5bdb', 'bright-yoga': '#e8590c' };
const accentFor = (slug) => ACCENTS[slug] || '#5f3dc4';

const initials = (name) =>
  String(name)
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const price = (cents) => (cents == null ? '' : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`);

// Formats '2030-01-15T09:00' without time zones, so output never depends on the machine.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function when(startsAt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(startsAt || '');
  if (!m) return { day: String(startsAt), time: '' };
  const [, y, mo, d, h, min] = m.map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const h12 = h % 12 || 12;
  return { day: `${weekday}, ${MONTHS[mo - 1]} ${d}`, time: `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` };
}

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><rect x="7" y="9" width="18" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M7 14h18M12 6.5v5M20 6.5v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M12.5 19.5l2.3 2.2 4.7-4.7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CSS = `
  :root {
    --ink: #111827; --ink-2: #4b5563; --ink-3: #9ca3af;
    --line: #e5e7eb; --bg: #f4f5f7; --card: #ffffff;
    --ok: #0f7a44; --ok-bg: #e7f6ee; --bad: #b42318; --bad-bg: #fdecea; --warn: #9a6700; --warn-bg: #fff6db;
    --radius: 14px; --shadow: 0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.06);
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--ink); background: var(--bg); -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  [hidden] { display: none !important; }

  .topbar { background: var(--card); border-bottom: 1px solid var(--line); }
  .topbar-inner { max-width: 880px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--ink); letter-spacing: -.01em; }
  .brand:hover { text-decoration: none; }
  .logo-mark { width: 28px; height: 28px; color: var(--accent); }
  .tenant-chip { display: flex; align-items: center; gap: 8px; padding-left: 16px; border-left: 1px solid var(--line); color: var(--ink-2); font-weight: 600; }
  .avatar { width: 26px; height: 26px; border-radius: 7px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
  .nav { margin-left: auto; display: flex; gap: 4px; }
  .nav a { color: var(--ink-2); font-weight: 500; padding: 6px 12px; border-radius: 8px; }
  .nav a:hover { background: var(--bg); text-decoration: none; }
  .nav a.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, white); }

  main { max-width: 880px; margin: 0 auto; padding: 36px 20px 48px; }
  main.narrow { max-width: 560px; }
  h1 { font-size: 30px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 6px; }
  .lede { color: var(--ink-2); margin: 0 0 28px; }
  .eyebrow { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
  .back { display: inline-block; font-size: 14px; color: var(--ink-2); margin-bottom: 18px; }

  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
  .card-body { padding: 24px; }

  /* Home */
  #tenants { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .tenant-card { display: flex; align-items: center; gap: 14px; padding: 20px; color: var(--ink); transition: transform .15s, box-shadow .15s; }
  .tenant-card:hover { text-decoration: none; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16,24,40,.10); }
  .tenant-card .avatar { width: 44px; height: 44px; border-radius: 11px; font-size: 15px; }
  .tenant-card strong { display: block; font-size: 17px; }
  .tenant-card span { color: var(--ink-2); font-size: 14px; }
  .hero { padding: 12px 0 32px; }
  .hero h1 { font-size: 40px; }

  /* Slots table */
  #slots { width: 100%; border-collapse: separate; border-spacing: 0; }
  #slots th { text-align: left; font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); padding: 14px 20px; border-bottom: 1px solid var(--line); }
  #slots td { padding: 16px 20px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  #slots tbody tr:last-child td { border-bottom: 0; }
  #slots tbody tr:hover td { background: #fafbfc; }
  .svc { font-weight: 600; }
  .sub { display: block; color: var(--ink-2); font-size: 14px; font-weight: 400; }
  .seats { display: inline-flex; align-items: baseline; gap: 5px; font-weight: 600; }
  .seats .of { color: var(--ink-3); font-weight: 400; font-size: 14px; }
  .bar { display: block; width: 84px; height: 5px; border-radius: 99px; background: var(--line); margin-top: 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .act { text-align: right; }

  .btn, button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: inherit; font-weight: 600; font-size: 15px; padding: 10px 18px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; transition: filter .15s, background .15s; }
  .btn-primary, button[type=submit] { background: var(--accent); color: #fff; }
  .btn-primary:hover, button[type=submit]:hover { filter: brightness(1.08); text-decoration: none; }
  .btn-ghost, button[type=button] { background: var(--card); color: var(--ink); border-color: var(--line); }
  .btn-ghost:hover, button[type=button]:hover { background: var(--bg); }
  .pill { display: inline-block; font-size: 13px; font-weight: 600; padding: 3px 10px; border-radius: 99px; background: var(--bg); color: var(--ink-2); }

  /* Forms */
  form label { display: block; font-size: 14px; font-weight: 600; margin: 18px 0 6px; }
  form label:first-child { margin-top: 0; }
  input, select { width: 100%; font: inherit; padding: 11px 13px; border: 1px solid #d0d5dd; border-radius: 10px; background: #fff; color: var(--ink); transition: border-color .15s, box-shadow .15s; }
  input:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
  form button[type=submit] { width: 100%; margin-top: 24px; padding: 13px 18px; }

  .summary { display: flex; align-items: center; gap: 14px; padding: 18px 24px; border-bottom: 1px solid var(--line); background: #fafbfc; border-radius: var(--radius) var(--radius) 0 0; }
  .summary .avatar { width: 40px; height: 40px; border-radius: 10px; font-size: 14px; }
  .summary strong { display: block; }
  .summary .price { margin-left: auto; font-size: 20px; font-weight: 700; }

  /* Messages */
  .msg { display: flex; align-items: center; gap: 10px; margin: 20px 0 0; padding: 14px 16px; border-radius: 10px; font-weight: 600; }
  .msg::before { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 800; }
  #confirmation, .msg.ok { background: var(--ok-bg); color: var(--ok); }
  #confirmation::before, .msg.ok::before { content: "\\2713"; background: var(--ok); }
  #error, .msg.bad { background: var(--bad-bg); color: var(--bad); }
  #error::before, .msg.bad::before { content: "!"; background: var(--bad); }
  .msg.warn { background: var(--warn-bg); color: var(--warn); }
  .msg.warn::before { content: "i"; background: var(--warn); }
  #status:empty { display: none; }

  /* Billing */
  .account { display: flex; flex-wrap: wrap; gap: 28px; padding: 20px 24px; border-bottom: 1px solid var(--line); }
  .account div { font-size: 13px; color: var(--ink-3); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
  .account strong { display: block; margin-top: 4px; font-size: 15px; color: var(--ink); text-transform: none; letter-spacing: 0; }
  #account-status { display: inline-block; padding: 2px 10px; border-radius: 99px; background: var(--bg); color: var(--ink-2); }
  #account-status[data-state="active"] { background: var(--ok-bg); color: var(--ok); }
  #account-status[data-state="pending_action"] { background: var(--warn-bg); color: var(--warn); }
  #account-plan { text-transform: capitalize; }
  .cards-hint { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--ink-3); }
  .cards-hint button { padding: 4px 10px; font-size: 13px; font-weight: 500; border-radius: 99px; }
  .cards-hint code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-2); }
  #threeds { margin-top: 20px; padding: 22px; border: 1px dashed #c9cfd8; border-radius: 12px; background: #fafbfc; text-align: center; }
  #threeds .bank { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 4px; }
  #threeds p { margin: 0 0 16px; color: var(--ink-2); }
  #threeds button { margin: 4px; }
  #threeds button#complete-3ds { background: var(--ok); color: #fff; border-color: var(--ok); }

  footer { max-width: 880px; margin: 0 auto; padding: 0 20px 36px; color: var(--ink-3); font-size: 13px; }

  @media (max-width: 600px) {
    .tenant-chip span.name { display: none; }
    #slots th:nth-child(3), #slots td:nth-child(3) { display: none; }
    #slots td, #slots th { padding: 14px; }
    h1, .hero h1 { font-size: 26px; }
  }
`;

function layout(title, body, { tenant, active, narrow } = {}) {
  const accent = tenant ? accentFor(tenant.slug) : '#5f3dc4';
  const tenantBits = tenant
    ? `<div class="tenant-chip"><span class="avatar" aria-hidden="true">${esc(initials(tenant.name))}</span><span class="name">${esc(tenant.name)}</span></div>
       <nav class="nav">
         <a href="/t/${esc(tenant.slug)}"${active === 'schedule' ? ' class="active"' : ''}>Schedule</a>
         <a href="/t/${esc(tenant.slug)}/billing"${active === 'billing' ? ' class="active"' : ''}>Billing</a>
       </nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body style="--accent: ${accent}">
<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/">${LOGO}SlotKit</a>
  ${tenantBits}
</div></header>
<main${narrow ? ' class="narrow"' : ''}>${body}</main>
<footer>SlotKit is a demo app for QA practice. No real payments or bookings.</footer>
</body>
</html>`;
}

function home(tenants) {
  const items = tenants
    .map(
      (t) => `<li><a class="card tenant-card" href="/t/${esc(t.slug)}" style="--accent: ${accentFor(t.slug)}">
  <span class="avatar" aria-hidden="true">${esc(initials(t.name))}</span>
  <span><strong>${esc(t.name)}</strong><span>View schedule &rarr;</span></span>
</a></li>`
    )
    .join('');
  return layout(
    'SlotKit',
    `<section class="hero">
  <p class="eyebrow">Online booking</p>
  <h1>SlotKit</h1>
  <p class="lede">A demo booking app for QA practice. Pick a business to see its schedule.</p>
</section>
<ul id="tenants">${items}</ul>`
  );
}

function tenantPage(tenant, slots) {
  const rows = slots
    .map((s) => {
      const w = when(s.starts_at);
      const pct = s.capacity ? Math.round(((s.capacity - s.remaining) / s.capacity) * 100) : 0;
      return `<tr data-slot-id="${s.id}">
<td><span class="svc">${esc(s.service)}</span><span class="sub">${esc(price(s.price_cents))}</span></td>
<td><span class="svc">${esc(w.day)}</span><span class="sub">${esc(w.time)}</span></td>
<td><span class="seats"><span class="remaining">${s.remaining}</span><span class="of">of ${s.capacity} left</span></span><span class="bar"><i style="width:${pct}%"></i></span></td>
<td class="act">${s.remaining > 0 ? `<a class="btn btn-primary" href="/t/${esc(tenant.slug)}/book/${s.id}">Book</a>` : '<span class="pill">Full</span>'}</td></tr>`;
    })
    .join('');
  return layout(
    tenant.name,
    `<p class="eyebrow">Schedule</p>
<h1>${esc(tenant.name)}</h1>
<p class="lede">Choose a time that works for you.</p>
<div class="card">
<table id="slots"><thead><tr><th>Service</th><th>Time</th><th>Seats</th><th></th></tr></thead><tbody>${rows}</tbody></table>
</div>`,
    { tenant, active: 'schedule' }
  );
}

function bookPage(tenant, slot) {
  const w = when(slot.starts_at);
  return layout(
    `Book ${slot.service}`,
    `<a class="back" href="/t/${esc(tenant.slug)}">&larr; All times</a>
<h1>Book ${esc(slot.service)}</h1>
<p class="lede">Add your details to reserve this time.</p>
<div class="card">
  <div class="summary">
    <span class="avatar" aria-hidden="true">${esc(initials(tenant.name))}</span>
    <span><strong>${esc(w.day)} at ${esc(w.time)}</strong><span class="sub">${esc(slot.service)} with ${esc(tenant.name)}</span></span>
    <span class="price">${esc(price(slot.price_cents))}</span>
  </div>
  <div class="card-body">
    <form id="book-form" novalidate>
      <label for="name">Name</label><input id="name" autocomplete="off">
      <label for="email">Email</label><input id="email" autocomplete="off">
      <button type="submit" id="submit">Confirm booking</button>
    </form>
    <p id="confirmation" class="msg" hidden></p>
    <p id="error" class="msg" role="alert" hidden></p>
  </div>
</div>
<script>
(function () {
  var slug = ${js(tenant.slug)};
  var slotId = ${Number(slot.id)};
  var form = document.getElementById('book-form');
  var ok = document.getElementById('confirmation');
  var err = document.getElementById('error');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    ok.hidden = true; err.hidden = true;
    var res = await fetch('/api/t/' + slug + '/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slot_id: slotId,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value
      })
    });
    var data = await res.json();
    if (res.ok) {
      ok.textContent = 'Booking #' + data.id + ' confirmed';
      ok.hidden = false;
    } else {
      err.textContent = data.error + (data.fields ? ': ' + Object.keys(data.fields).join(', ') : '');
      err.hidden = false;
    }
  });
})();
</script>`,
    { tenant, narrow: true }
  );
}

function billingPage(tenant) {
  const status = tenant.subscription_status;
  return layout(
    `Billing - ${tenant.name}`,
    `<p class="eyebrow">Account</p>
<h1>Billing</h1>
<p class="lede">Manage the SlotKit subscription for ${esc(tenant.name)}.</p>
<div class="card">
  <div class="account">
    <div>Status<strong><span id="account-status" data-state="${esc(status)}">${esc(status)}</span></strong></div>
    <div>Current plan<strong id="account-plan">${esc(tenant.plan)}</strong></div>
  </div>
  <div class="card-body">
    <form id="subscribe-form" novalidate>
      <label for="plan">Plan</label>
      <select id="plan"><option value="starter">Starter ($29)</option><option value="pro">Pro ($79)</option></select>
      <label for="card">Card number</label><input id="card" value="4242 4242 4242 4242" autocomplete="off">
      <div class="cards-hint">Test cards:
        <button type="button" data-card="4242 4242 4242 4242">Succeeds <code>4242</code></button>
        <button type="button" data-card="4000 0000 0000 3220">Needs 3DS <code>3220</code></button>
        <button type="button" data-card="4000 0000 0000 0002">Declined <code>0002</code></button>
      </div>
      <button type="submit" id="subscribe">Subscribe</button>
    </form>
    <section id="threeds" hidden>
      <div class="bank">&#128274; Demo Bank</div>
      <p>Your bank needs to verify this payment.</p>
      <button type="button" id="complete-3ds">Complete authentication</button>
      <button type="button" id="fail-3ds">Fail authentication</button>
    </section>
    <p id="status" class="msg" role="status"></p>
  </div>
</div>
<script>
(function () {
  var slug = ${js(tenant.slug)};
  var statusEl = document.getElementById('status');
  var threeds = document.getElementById('threeds');
  var intentId = null;
  function show(text, kind) { statusEl.textContent = text; statusEl.className = 'msg ' + kind; }
  async function post(path, body) {
    var res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  document.querySelectorAll('[data-card]').forEach(function (b) {
    b.addEventListener('click', function () { document.getElementById('card').value = b.dataset.card; });
  });
  document.getElementById('subscribe-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await post('/api/t/' + slug + '/subscribe', {
      plan: document.getElementById('plan').value,
      card: document.getElementById('card').value
    });
    if (r.status === 200) show('Subscription active: ' + r.data.plan, 'ok');
    else if (r.status === 202) { intentId = r.data.intent_id; threeds.hidden = false; show('Authentication required', 'warn'); }
    else show('Payment failed: ' + (r.data.error || r.status), 'bad');
  });
  async function finish(result) {
    var r = await post('/api/t/' + slug + '/subscribe/complete', { intent_id: intentId, result: result });
    threeds.hidden = true;
    if (r.status === 200) show('Subscription active: ' + r.data.plan, 'ok');
    else show('Payment failed: ' + (r.data.error || r.status), 'bad');
  }
  document.getElementById('complete-3ds').addEventListener('click', function () { finish('pass'); });
  document.getElementById('fail-3ds').addEventListener('click', function () { finish('fail'); });
})();
</script>`,
    { tenant, active: 'billing', narrow: true }
  );
}

function notFound() {
  return layout(
    'Not found',
    '<p class="eyebrow">404</p><h1>Page not found</h1><p class="lede">That page doesn\'t exist.</p><a class="btn btn-primary" href="/">Back to home</a>'
  );
}

module.exports = { home, tenantPage, bookPage, billingPage, notFound };
