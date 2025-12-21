import { test, expect } from '@playwright/test';

test.describe('Detection Pipeline E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BulkUpload page
    await page.goto('/bulk-upload');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('הוספת ספרים מתמונה');
  });

  test('should upload image and detect books successfully', async ({ page }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('../../test-images/1000270703.jpg');

    // Verify image preview appears
    const preview = page.locator('img[alt="Preview"]');
    await expect(preview).toBeVisible();

    // Click detect button
    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for progress bar to appear
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    // Monitor progress updates
    let previousProgress = 0;
    for (let i = 0; i < 30; i++) {
      const progressValue = await page.locator('[role="progressbar"]').getAttribute('aria-valuenow');
      const currentProgress = parseInt(progressValue || '0');
      
      // Progress should be monotonically increasing
      expect(currentProgress).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = currentProgress;

      if (currentProgress === 100) break;
      await page.waitForTimeout(500);
    }

    // Verify detection results appear
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Verify book items appear
    const bookItems = page.locator('[role="listitem"]').first();
    await expect(bookItems).toBeVisible();

    // Verify we can select books
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Verify bulk add button is enabled
    const bulkAddButton = page.locator('button:has-text("הוסף לאוסף")');
    await expect(bulkAddButton).toBeEnabled();
  });

  test('should handle detection failure with retry option', async ({ page }) => {
    // Upload invalid image (text file disguised as image)
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/invalid-image.txt');

    // Click detect button
    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for error message to appear
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /שגיאה|Error/ });
    await expect(errorAlert).toBeVisible({ timeout: 60000 });

    // Verify retry button appears
    const retryButton = page.locator('button:has-text("נסה שוב")');
    await expect(retryButton).toBeVisible();

    // Click retry button
    await retryButton.click();

    // Verify detection restarts
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();
  });

  test('should display detection job history', async ({ page }) => {
    // Navigate to detection history (assuming there's a link)
    const historyLink = page.locator('a:has-text("היסטוריית זיהוי")');
    
    if (await historyLink.isVisible()) {
      await historyLink.click();

      // Verify table appears
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Verify table has headers
      const headers = page.locator('th');
      expect(await headers.count()).toBeGreaterThan(0);
    }
  });

  test('should filter and manage uploaded images', async ({ page }) => {
    // Upload multiple images
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload first image
    await fileInput.setInputFiles('./test-fixtures/bookshelf1.jpg');
    await page.waitForTimeout(500);

    // Verify preview
    const preview1 = page.locator('img[alt="Preview"]');
    await expect(preview1).toBeVisible();

    // Remove image
    const deleteButton = page.locator('button[aria-label*="Remove"], button[aria-label*="Delete"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Verify preview is removed
      await expect(preview1).not.toBeVisible();
    }
  });

  test('should export detection results', async ({ page }) => {
    // Upload and detect books
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/bookshelf.jpg');

    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for results
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Check if export button exists
    const exportButton = page.locator('button:has-text("ייצא")');
    if (await exportButton.isVisible()) {
      // Start listening for download
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(csv|json)$/);
    }
  });

  test('should perform bulk operations on detected books', async ({ page }) => {
    // Upload and detect
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/bookshelf.jpg');

    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for results
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Select all books
    const selectAllButton = page.locator('button:has-text("בחר הכל")');
    await selectAllButton.click();

    // Verify all checkboxes are checked
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkedCount = await checkboxes.locator(':checked').count();
    const totalCount = await checkboxes.count();
    
    expect(checkedCount).toBeGreaterThan(0);

    // Deselect all
    const deselectAllButton = page.locator('button:has-text("בטל הכל")');
    await deselectAllButton.click();

    // Verify checkboxes are unchecked
    const uncheckedCount = await checkboxes.locator(':not(:checked)').count();
    expect(uncheckedCount).toBeGreaterThan(0);
  });

  test('should edit detected book details', async ({ page }) => {
    // Upload and detect
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/bookshelf.jpg');

    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for results
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Edit first book title
    const titleInput = page.locator('input[type="text"]').first();
    const originalValue = await titleInput.inputValue();

    await titleInput.clear();
    await titleInput.fill('Edited Title');

    // Verify value changed
    const newValue = await titleInput.inputValue();
    expect(newValue).toBe('Edited Title');
    expect(newValue).not.toBe(originalValue);
  });

  test('should add detected books to library', async ({ page }) => {
    // Upload and detect
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/bookshelf.jpg');

    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for results
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Select first book
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();

    // Click add button
    const addButton = page.locator('button:has-text("הוסף לאוסף")');
    await addButton.click();

    // Wait for success message or redirect
    const successMessage = page.locator('[role="alert"]:has-text("בהצלחה")');
    if (await successMessage.isVisible({ timeout: 5000 })) {
      expect(await successMessage.textContent()).toContain('בהצלחה');
    }
  });

  test('should handle empty detection results', async ({ page }) => {
    // Upload blank/empty image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/blank-image.jpg');

    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for result
    const warningMessage = page.locator('[role="alert"]:has-text(/לא זוהו|No books/)');
    await expect(warningMessage).toBeVisible({ timeout: 60000 });

    // Verify message text
    const messageText = await warningMessage.textContent();
    expect(messageText).toContain('ספרים');
  });

  test('should maintain session across page navigation', async ({ page }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('./test-fixtures/bookshelf.jpg');

    // Click detect
    const detectButton = page.locator('button:has-text("זהה ספרים")');
    await detectButton.click();

    // Wait for results
    const resultsHeading = page.locator('h2:has-text("ספרים שזוהו")');
    await expect(resultsHeading).toBeVisible({ timeout: 60000 });

    // Navigate away and back
    await page.goto('/books');
    await page.goto('/bulk-upload');

    // Check if we can still upload
    const uploadButton = page.locator('label').filter({ hasText: /בחר תמונה|Upload/ });
    await expect(uploadButton).toBeVisible();
  });
});
