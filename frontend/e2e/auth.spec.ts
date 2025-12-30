import { test, expect } from '@playwright/test';
import { registerUser, loginUser, generateUserData } from './utils/auth';

test.describe('Authentication & Persistence', () => {
  let userData: any;

  test.beforeAll(() => {
    userData = generateUserData();
  });

  test('Login, Session Persistence, and Logout', async ({ page }) => {
    // 1. Register and Login
    await registerUser(page, userData);
    await loginUser(page, userData.email, userData.password);
    
    // Verify logged in
    await expect(page).toHaveURL('/');
    await expect(page.locator('header').getByRole('button', { name: userData.email[0].toUpperCase() })).toBeVisible();

    // 2. Test Persistence (Reload)
    await page.reload();
    await expect(page.getByRole('button', { name: userData.email[0].toUpperCase() })).toBeVisible();
    
    // 3. Test Logout
    await page.getByRole('button', { name: userData.email[0].toUpperCase() }).click();
    await page.getByRole('menuitem', { name: 'התנתק' }).click();
    
    // Verify logged out
    await expect(page).toHaveURL('/login');
    
    // 4. Verify protected route access denied
    await page.goto('/books');
    await expect(page).toHaveURL('/login');
  });
});
