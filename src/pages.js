'use strict';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; color: #1d2430; background: #f6f7f9; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3e6ea; }
  label { display: block; margin-top: 12px; font-weight: 600; }
  input, select { width: 100%; padding: 8px; font: inherit; box-sizing: border-box; }
  button { margin-top: 16px; padding: 8px 16px; font: inherit; cursor: pointer; }
  [hidden] { display: none !important; }
  #confirmation { color: #176b3a; font-weight: 600; }
  #error { color: #a3231a; font-weight: 600; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function home(tenants) {
  const items = tenants.map((t) => `<li><a href="/t/${esc(t.slug)}">${esc(t.name)}</a></li>`).join('');
  return layout('SlotKit', `<h1>SlotKit</h1><p>A demo booking app for QA practice.</p><ul id="tenants">${items}</ul>`);
}

function tenantPage(tenant, slots) {
  const rows = slots
    .map(
      (s) => `<tr data-slot-id="${s.id}">
<td>${esc(s.service)}</td><td>${esc(s.starts_at)}</td><td class="remaining">${s.remaining}</td>
<td>${s.remaining > 0 ? `<a href="/t/${esc(tenant.slug)}/book/${s.id}">Book</a>` : 'Full'}</td></tr>`
    )
    .join('');
  return layout(
    tenant.name,
    `<h1>${esc(tenant.name)}</h1>
<table id="slots"><thead><tr><th>Service</th><th>Time</th><th>Left</th><th></th></tr></thead><tbody>${rows}</tbody></table>
<p><a href="/t/${esc(tenant.slug)}/billing">Billing</a></p>`
  );
}

function bookPage(tenant, slot) {
  return layout(
    `Book ${slot.service}`,
    `<h1>Book ${esc(slot.service)}</h1>
<p>${esc(tenant.name)} &middot; ${esc(slot.starts_at)}</p>
<form id="book-form" novalidate>
  <label for="name">Name</label><input id="name" autocomplete="off">
  <label for="email">Email</label><input id="email" autocomplete="off">
  <button type="submit" id="submit">Confirm booking</button>
</form>
<p id="confirmation" hidden></p>
<p id="error" role="alert" hidden></p>
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
</script>`
  );
}

function billingPage(tenant) {
  return layout(
    `Billing - ${tenant.name}`,
    `<h1>Billing</h1>
<p>Account status: <strong id="account-status">${esc(tenant.subscription_status)}</strong> &middot; Plan: <strong id="account-plan">${esc(tenant.plan)}</strong></p>
<form id="subscribe-form" novalidate>
  <label for="plan">Plan</label>
  <select id="plan"><option value="starter">Starter ($29)</option><option value="pro">Pro ($79)</option></select>
  <label for="card">Card number</label><input id="card" value="4242 4242 4242 4242" autocomplete="off">
  <button type="submit" id="subscribe">Subscribe</button>
</form>
<section id="threeds" hidden>
  <p>Your bank needs to verify this payment.</p>
  <button type="button" id="complete-3ds">Complete authentication</button>
  <button type="button" id="fail-3ds">Fail authentication</button>
</section>
<p id="status" role="status"></p>
<script>
(function () {
  var slug = ${js(tenant.slug)};
  var statusEl = document.getElementById('status');
  var threeds = document.getElementById('threeds');
  var intentId = null;
  async function post(path, body) {
    var res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  document.getElementById('subscribe-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await post('/api/t/' + slug + '/subscribe', {
      plan: document.getElementById('plan').value,
      card: document.getElementById('card').value
    });
    if (r.status === 200) statusEl.textContent = 'Subscription active: ' + r.data.plan;
    else if (r.status === 202) { intentId = r.data.intent_id; threeds.hidden = false; statusEl.textContent = 'Authentication required'; }
    else statusEl.textContent = 'Payment failed: ' + (r.data.error || r.status);
  });
  async function finish(result) {
    var r = await post('/api/t/' + slug + '/subscribe/complete', { intent_id: intentId, result: result });
    threeds.hidden = true;
    if (r.status === 200) statusEl.textContent = 'Subscription active: ' + r.data.plan;
    else statusEl.textContent = 'Payment failed: ' + (r.data.error || r.status);
  }
  document.getElementById('complete-3ds').addEventListener('click', function () { finish('pass'); });
  document.getElementById('fail-3ds').addEventListener('click', function () { finish('fail'); });
})();
</script>`
  );
}

function notFound() {
  return layout('Not found', '<h1>Not found</h1><p><a href="/">Home</a></p>');
}

module.exports = { home, tenantPage, bookPage, billingPage, notFound };
