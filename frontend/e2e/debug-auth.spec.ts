import { test, expect } from '@playwright/test';

test('debug login error message', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'nonexistent@example.com');
  await page.click('[data-testid="submit-button"]');
  
  // Wait a bit for any response
  await page.waitForTimeout(2000);
  
  // Log all text content to see what's on the page
  const content = await page.content();
  console.log('Page content:', content);
  
  // Take a screenshot
  await page.screenshot({ path: 'login-error-debug.png' });
  
  // Check for any visible error alerts
  const alerts = page.locator('[role="alert"]');
  const count = await alerts.count();
  console.log(`Found ${count} alerts`);
  if (count > 0) {
    console.log('Alert text:', await alerts.first().textContent());
  }
});
