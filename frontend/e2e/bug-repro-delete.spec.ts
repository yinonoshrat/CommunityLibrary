import { test, expect } from '@playwright/test';
import { registerUser, loginUser, generateUserData } from './utils/auth';

test.describe('Bug Reproduction: Delete Persistence', () => {
  let userData: any;

  test.beforeAll(() => {
    userData = generateUserData();
  });

  test('Deleted book should be removed from catalog immediately', async ({ page }) => {
    // 1. Register and Login
    await registerUser(page, userData);
    await loginUser(page, userData.email, userData.password);

    // 2. Add a Book
    const bookTitle = `Delete Test Book ${Date.now()}`;
    await page.goto('/books/add');
    await page.getByLabel('single book').click();
    
    await page.locator('input[name="title"]').fill(bookTitle);
    await page.locator('input[name="author"]').fill('Test Author');
    await page.getByLabel("ז'אנר").click();
    await page.getByRole('option', { name: 'פנטזיה' }).click();
    await page.waitForTimeout(500); // Wait for select animation
    
    await page.getByRole('button', { name: 'שמור ספר' }).click();
    await expect(page).toHaveURL(/\/books/);

    // 3. Verify it appears in "My Books"
    // We might need to wait for the list to refresh or ensure we are on the right view
    // Reload to ensure we are not hitting a race condition in the test itself
    await page.reload();
    
    // Debug: Print all book cards
    const titles = await page.getByTestId('catalog-book-card').allTextContents();
    console.log('Found books:', titles);

    await expect(page.getByText(bookTitle)).toBeVisible();

    // 4. Delete the Book
    // Click details
    await page.getByText(bookTitle).click();
    
    // Click Delete button (trash icon or text)
    // In BookDetails.tsx: <Button ... startIcon={<DeleteIcon />}>מחק ספר</Button>
    await page.getByRole('button', { name: 'מחק ספר' }).click();
    
    // Confirm Delete Dialog
    await page.getByRole('button', { name: 'מחק', exact: true }).click();

    // 5. Verify Redirection and Removal
    // Use strict regex to ensure we are on the list page, not details page
    // Allow query parameters (e.g. ?view=my) but not sub-paths
    await expect(page).toHaveURL(/\/books(\?.*)?$/);
    
    // CRITICAL CHECK: Is it gone?
    // We wait a bit to ensure any optimistic UI or refetch has happened
    await page.waitForTimeout(1000);
    await expect(page.getByText(bookTitle)).not.toBeVisible();
    
    // 6. Double Check: Reload page to verify server state
    await page.reload();
    await expect(page.getByText(bookTitle)).not.toBeVisible();
  });
});
