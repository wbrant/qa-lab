'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ request }) => {
  await request.post('/__admin/reset', { data: {} });
});

test('a normal card activates the subscription', async ({ page }) => {
  await page.goto('/t/acme-cuts/billing');
  await page.getByLabel('Plan').selectOption('pro');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#status')).toContainText('Subscription active');

  await page.reload();
  await expect(page.locator('#account-status')).toHaveText('active');
  await expect(page.locator('#account-plan')).toHaveText('pro');
});

test('a 3DS card activates only after the challenge, and the account really changes', async ({ page }) => {
  await page.goto('/t/acme-cuts/billing');
  await page.getByLabel('Card number').fill('4000 0000 0000 3220');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#threeds')).toBeVisible();

  await page.getByRole('button', { name: 'Complete authentication' }).click();
  await expect(page.locator('#status')).toContainText('Subscription active');

  // The UI message alone is not proof: reload and check what the server stored.
  await page.reload();
  await expect(page.locator('#account-status')).toHaveText('active');
});

test('a declined card shows a failure and leaves the account unchanged', async ({ page }) => {
  await page.goto('/t/acme-cuts/billing');
  await page.getByLabel('Card number').fill('4000 0000 0000 0002');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#status')).toContainText('Payment failed');

  await page.reload();
  await expect(page.locator('#account-status')).toHaveText('none');
});
