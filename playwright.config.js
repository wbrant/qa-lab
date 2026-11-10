'use strict';
const { defineConfig } = require('@playwright/test');

const PORT = process.env.PORT || 3000;

// The app keeps all state in memory, so run one worker and reset before each test.
// Switch bugs on for a demo:  QA_BUGS=error-200 npm run e2e
module.exports = defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node src/server.js',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), QA_BUGS: process.env.QA_BUGS || '' },
  },
});
