import { expect, test } from '@playwright/test';

test('visits the app root url and lands on sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-content')).toContainText('VanDesk');
});

test('a driver signs in and lands on the trip screen', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Ramesh Kale').click();
  await expect(page.locator('ion-tab-button[tab="trip"]')).toBeVisible();
});
