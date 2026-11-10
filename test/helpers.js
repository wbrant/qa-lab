'use strict';
const { createApp } = require('../src/app');

// Starts a fresh app (fresh in-memory database) on a random port.
// Bugs come from opts.bugs or the QA_BUGS environment variable.
async function startLab(opts = {}) {
  const app = createApp(opts);
  const server = await app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html or empty */
    }
    return { status: res.status, body: json, text };
  }

  return { app, base, api, close: () => app.close() };
}

async function firstSlot(lab, slug, { capacity } = {}) {
  const { body } = await lab.api('GET', `/api/t/${slug}/slots`);
  return body.find((s) => capacity === undefined || s.capacity === capacity);
}

module.exports = { startLab, firstSlot };
