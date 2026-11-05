import { expect, test } from '@playwright/test';

test('signed-out visitors land on the VanDesk sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-content')).toContainText('Demo sign-in');
  await expect(page).toHaveURL(/#\/login$/);
});

test('a driver can sign in and sees the Fees tab', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Ramesh Kale').click();
  await expect(page).toHaveURL(/#\/driver\/fees$/);
  await expect(page.locator('ion-content')).toContainText('Rohan More');
});
