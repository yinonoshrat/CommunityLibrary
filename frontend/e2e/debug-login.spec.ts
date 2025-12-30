import { test } from '@playwright/test';

test('debug login page', async ({ page }) => {
  await page.goto('/login');
  await page.waitForTimeout(3000); // Wait for auth check to complete
  console.log(await page.content());
});
