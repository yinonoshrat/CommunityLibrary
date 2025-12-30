import { test, expect, type Page } from '@playwright/test';

// Helper function to generate unique user data
function generateUserData() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `user${timestamp}@example.com`,
    password: 'Test1234!',
    phone: '0501234567',
    familyName: `Family ${timestamp}`
  };
}

// Helper function to register a new user
async function registerUser(page: Page, userData: any) {
  await page.goto('/register');
  
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.getByLabel('אימות סיסמה').fill(userData.password);
  await page.fill('input[name="phone"]', userData.phone);
  await page.fill('input[name="familyName"]', userData.familyName);
  
  await page.click('[data-testid="submit-button"]');
  await page.waitForURL('/login');
}

// Helper function for login
async function login(page: Page, email: string) {
  await page.goto('/login');
  
  // Step 1: Email
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  
  // Step 2: Password
  await page.waitForSelector('input[name="password"]');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Delete Book Bug Reproduction', () => {
  let userData: any;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    userData = generateUserData();
    await registerUser(page, userData);
    await login(page, userData.email);
  });

  test('should remove book from catalog after deletion', async ({ page }) => {
    // 1. Add a book manually
    await page.goto('/books/add');
    await page.click('text=הוספה ידנית');
    
    const bookTitle = `Test Book ${Date.now()}`;
    await page.fill('input[name="title"]', bookTitle);
    await page.fill('input[name="author"]', 'Test Author');
    await page.click('button[type="submit"]');
    
    // Wait for success and redirect
    await expect(page).toHaveURL(/\/books\/[a-f0-9-]+/);
    
    // 2. Verify book is in catalog
    await page.goto('/books');
    await expect(page.getByText(bookTitle)).toBeVisible();
    
    // 3. Go to book details
    await page.click(`text=${bookTitle}`);
    
    // 4. Delete the book
    // Click delete icon/button
    await page.click('button[aria-label="delete"]'); // Assuming aria-label or similar
    // Confirm delete in dialog
    await page.click('text=מחק'); // Assuming Hebrew text "Delete"
    
    // 5. Verify redirect to catalog
    await expect(page).toHaveURL('/books');
    
    // 6. Verify book is NOT in catalog
    await expect(page.getByText(bookTitle)).not.toBeVisible();
  });
});
