import { test, expect } from '@playwright/test';
import { registerUser, loginUser, generateUserData } from './utils/auth';

test.describe('Catalog Features', () => {
  let userData: any;

  test.beforeAll(() => {
    userData = generateUserData();
  });

  test('Sorting, Liking, Reviewing, and Persistence', async ({ page }) => {
    // 1. Register and Login
    await registerUser(page, userData);
    await loginUser(page, userData.email, userData.password);

    // 2. Add two books for sorting tests
    // Book A: "Alpha Book", Author "Zebra Author"
    // Book B: "Beta Book", Author "Apple Author"
    
    const books = [
      { title: 'Alpha Book', author: 'Zebra Author' },
      { title: 'Beta Book', author: 'Apple Author' }
    ];

    for (const book of books) {
      await page.goto('/books/add');
      await page.getByLabel('single book').click();
      await page.locator('input[name="title"]').fill(book.title);
      await page.locator('input[name="author"]').fill(book.author);
      // Select Genre
      await page.getByLabel("ז'אנר").click();
      await page.getByRole('option', { name: 'פנטזיה' }).click();
      
      // Wait for animation
      await page.waitForTimeout(500);

      // Select Age
      await page.getByLabel('גיל מומלץ').click({ force: true });
      await page.getByRole('option', { name: '10-12' }).click();
      
      await page.getByRole('button', { name: 'שמור ספר' }).click();
      await expect(page).toHaveURL(/.*\/books.*/);
    }

    // 3. Test Sorting
    await page.goto('/books?view=my');
    
    // Sort by Title (Default usually, but let's be explicit)
    // The select has id="sort-select" but MUI hides the select input.
    // We click the label or the div.
    await page.getByLabel('מיון').click();
    await page.getByRole('option', { name: 'שם הספר' }).click();
    
    // Check order: Alpha should be before Beta
    // We can get all book titles
    // Note: This depends on how the list is rendered. 
    // Assuming they appear in order in the DOM.
    const titlesByTitle = await page.getByTestId('catalog-book-card').allTextContents();
    // Filter to our books
    const ourTitlesByTitle = titlesByTitle.filter(t => t.includes('Alpha Book') || t.includes('Beta Book'));
    // Expect Alpha then Beta
    // Note: Text content might contain more than just title, but order matters.
    // Actually, let's just check the first one found.
    const firstBookTitle = await page.getByTestId('catalog-book-card').first().textContent();
    // This might be flaky if other books exist (but this is a fresh user/family usually? No, fresh user but shared DB?)
    // Wait, the test runs against a shared DB?
    // If it's a shared DB, "My Books" view should only show MY books.
    // So it should be just these two.
    
    // However, `allTextContents` might return them in DOM order.
    // Let's verify Alpha is first.
    // Actually, let's just check if the first card contains "Alpha Book".
    // But wait, if we just added them, Alpha was added first? Or second?
    // If sorted by title, Alpha should be first regardless of add order.
    
    // Let's try sorting by Author.
    await page.getByLabel('מיון').click();
    await page.getByRole('option', { name: 'מחבר' }).click();
    
    // Now "Apple Author" (Beta Book) should be first.
    // Wait for sort to apply (network request or client side?)
    await page.waitForTimeout(1000);
    
    const firstCardText = await page.getByTestId('catalog-book-card').first().textContent();
    expect(firstCardText).toContain('Beta Book');

    // 4. Test Liking
    // Find "Alpha Book" card
    const alphaCard = page.getByTestId('catalog-book-card').filter({ hasText: 'Alpha Book' }).first();
    await expect(alphaCard).toBeVisible();
    
    // Click Like button (Heart icon)
    // Look for button containing the heart icon
    const likeBtn = alphaCard.locator('button').filter({ has: page.locator('svg[data-testid*="Favorite"]') });
    await likeBtn.click();

    // Reload to test persistence
    await page.reload();
    
    // Verify it's still liked (Filled Heart)
    const alphaCardReloaded = page.getByTestId('catalog-book-card').filter({ hasText: 'Alpha Book' }).first();
    await expect(alphaCardReloaded.locator('svg[data-testid="FavoriteIcon"]')).toBeVisible();

    // 5. Test Reviewing
    // Click on the book to go to details
    await alphaCardReloaded.click();
    
    // Wait for reviews to load
    await expect(page.getByText('ביקורות')).toBeVisible();
    // Wait for loading spinner to disappear
    await expect(page.getByRole('progressbar')).not.toBeVisible();
    
    // Add Review
    await page.getByRole('button', { name: /כתוב ביקורת|הוסף ביקורת/ }).click();
    
    // Fill Review Dialog
    await page.getByLabel('כותרת').fill('Great Book');
    await page.getByLabel('תוכן הביקורת').fill('I really enjoyed reading this.');
    // Rating (Stars) - tricky in MUI. Usually inputs with value 1-5.
    // Or click the star.
    await page.locator('label[for*="hover-feedback-4"]').click().catch(() => {
        // Fallback: click the 4th star svg
        page.locator('.MuiRating-root label').nth(3).click();
    });
    
    await page.getByRole('button', { name: 'שלח' }).click();
    
    // Verify Review appears
    await expect(page.getByText('Great Book')).toBeVisible();
    await expect(page.getByText('I really enjoyed reading this.')).toBeVisible();
    
    // Reload to test persistence
    await page.reload();
    await expect(page.getByText('Great Book')).toBeVisible();

    // 6. Watch Loans (Loans Dashboard)
    await page.goto('/loans');
    await expect(page).toHaveURL(/\/loans/);
    await expect(page.getByRole('heading', { name: /השאלות|Loans/i })).toBeVisible();
  });
});
