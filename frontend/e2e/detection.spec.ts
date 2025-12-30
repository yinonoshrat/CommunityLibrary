import { test, expect } from '@playwright/test';
import { registerUser, loginUser, generateUserData } from './utils/auth';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Book Detection & Bulk Add', () => {
  let userData: any;

  test.beforeAll(() => {
    userData = generateUserData();
  });

  test('Detect books from image and add to library', async ({ page }) => {
    // 1. Register and Login
    await registerUser(page, userData);
    await loginUser(page, userData.email, userData.password);

    // 2. Go to Add Book -> Bulk Upload
    console.log('Navigating to /books/add');
    await page.goto('/books/add');
    
    // Ensure we are on Add Book page
    await expect(page).toHaveURL(/\/books\/add/);
    
    // Select Bulk Upload (AI) mode
    // Wait for the tab/button to be visible
    await page.getByLabel('bulk upload').waitFor({ state: 'visible' });
    await page.getByLabel('bulk upload').click();

    // 3. Mock the Detection API to avoid external calls
    const mockJobId = 'mock-job-123';
    const mockBooks = [
      {
        title: 'Harry Potter and the Sorcerer\'s Stone',
        author: 'J.K. Rowling',
        description: 'A young wizard discovers his heritage.',
        isbn: '9780590353427',
        confidence: 'high'
      },
      {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        description: 'A hobbit goes on an adventure.',
        isbn: '9780547928227',
        confidence: 'high'
      }
    ];

    // Mock the upload endpoint
    await page.route('**/api/books/detect-from-image', async route => {
      console.log('Mocking /api/books/detect-from-image');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: mockJobId })
      });
    });

    // Mock the status endpoint
    await page.route(`**/api/books/detect-job/${mockJobId}`, async route => {
      console.log(`Mocking /api/books/detect-job/${mockJobId}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockJobId,
          status: 'completed',
          progress: 100,
          result: {
            count: mockBooks.length,
            books: mockBooks
          }
        })
      });
    });

    // 4. Upload Image
    // The workspace has 'test-images/1000270703.jpg'.
    // Resolve path relative to this file (frontend/e2e/detection.spec.ts) -> ../../test-images
    const imagePath = path.resolve(__dirname, '../../test-images/1000270703.jpg');
    
    console.log(`Uploading image from: ${imagePath}`);
    
    // Set input files
    await page.setInputFiles('input[type="file"]', imagePath);

    // 5. Verify Detection Results
    // Wait for results to appear
    await expect(page.getByText('Harry Potter')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('The Hobbit')).toBeVisible();

    // 6. Add Books to Library
    // Select all (if not auto-selected) or just click "Add Selected"
    const addButton = page.getByRole('button', { name: /הוסף.*ספרים|Add.*Books/i });
    await addButton.click();

    // 7. Verify Success and Redirect
    // Should redirect to /books or show success message
    await expect(page).toHaveURL(/\/books/);
    
    // Verify books are in the list
    await expect(page.getByText('Harry Potter')).toBeVisible();
    await expect(page.getByText('The Hobbit')).toBeVisible();
  });
});
