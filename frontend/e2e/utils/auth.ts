import { Page, expect } from '@playwright/test';

export function generateUserData() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    name: `Test User ${timestamp}-${random}`,
    email: `user${timestamp}-${random}@example.com`,
    password: 'Test1234!',
    phone: '0501234567',
    familyName: `Family ${timestamp}-${random}`
  };
}

export async function registerUser(page: Page, userData: any) {
  console.log(`[Register] Starting registration for ${userData.email}`);
  await page.goto('/register');
  
  // Step 1: User Details
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.locator('input[type="password"]').nth(1).fill(userData.password);
  await page.fill('input[name="phone"]', userData.phone);
  
  await page.click('[data-testid="submit-button"]');
  console.log('[Register] Step 1 submitted');
  
  // Step 2: Family Details (if wizard proceeds)
  // Wait for animation/transition
  await page.waitForTimeout(1000);
  
  const newFamilyRadio = page.locator('input[value="new"]');
  if (await newFamilyRadio.isVisible()) {
    console.log('[Register] Selecting new family');
    await newFamilyRadio.click();
    await page.waitForTimeout(300);
  }
  
  const familyNameInput = page.locator('input[name="familyName"]');
  if (await familyNameInput.isVisible()) {
    console.log('[Register] Filling family name');
    await familyNameInput.fill(userData.familyName);
  }
  
  await page.click('[data-testid="submit-button"]');
  console.log('[Register] Final submit clicked');
  
  // Wait for redirect to login
  await expect(page).toHaveURL('/login', { timeout: 20000 });
  console.log('[Register] Redirected to login');
}

export async function loginUser(page: Page, email: string, password = 'Test1234!') {
  console.log(`[Login] Logging in ${email}`);
  await page.goto('/login');
  
  // Step 1: Email
  await page.fill('input[name="email"]', email);
  await page.click('[data-testid="submit-button"]');
  console.log('[Login] Email submitted');
  
  // Step 2: Password
  try {
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.fill('input[name="password"]', password);
    await page.click('[data-testid="submit-button"]');
    console.log('[Login] Password submitted');
  } catch (e) {
    console.error('[Login] Failed to find password field. Check if email exists.');
    // Dump content to see what happened
    // console.log(await page.content());
    throw e;
  }
  
  // Wait for redirect to home
  await expect(page).toHaveURL('/', { timeout: 20000 });
  console.log('[Login] Successfully logged in');
}
