'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ request }) => {
  await request.post('/__admin/reset', { data: {} });
});

test('a guest can book an open slot', async ({ page }) => {
  await page.goto('/t/acme-cuts');
  await page.getByRole('link', { name: 'Book' }).first().click();
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  const confirmation = page.locator('#confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('confirmed');
  await expect(confirmation).not.toContainText('undefined');
});

test('submitting an empty form shows a validation error, not a confirmation', async ({ page }) => {
  await page.goto('/t/acme-cuts');
  await page.getByRole('link', { name: 'Book' }).first().click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#confirmation')).toBeHidden();
});

test('a full slot no longer offers a Book link', async ({ page, request }) => {
  const slots = await (await request.get('/api/t/acme-cuts/slots')).json();
  const single = slots.find((s) => s.capacity === 1);
  await request.post('/api/t/acme-cuts/bookings', { data: { slot_id: single.id, name: 'Ada', email: 'ada@example.com' } });

  await page.goto('/t/acme-cuts');
  const row = page.locator(`tr[data-slot-id="${single.id}"]`);
  await expect(row.locator('.remaining')).toHaveText('0');
  await expect(row.getByRole('link', { name: 'Book' })).toHaveCount(0);
});
