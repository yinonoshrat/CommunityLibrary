import { test, expect, Page } from '@playwright/test';
import { registerUser, loginUser, generateUserData } from './utils/auth';

test.describe('Full Library Lifecycle', () => {
  let ownerData: any;
  let borrowerData: any;
  let bookTitle: string;

  test.beforeAll(async () => {
    ownerData = generateUserData();
    borrowerData = generateUserData();
    bookTitle = `Test Book ${Date.now()}`;
  });

  test('Complete book lifecycle: Add -> Lend -> Return -> Delete', async ({ browser }) => {
    test.setTimeout(120000); // Increase timeout to 2 minutes
    
    // Create two isolated contexts
    const ownerContext = await browser.newContext();
    const borrowerContext = await browser.newContext();
    
    const ownerPage = await ownerContext.newPage();
    const borrowerPage = await borrowerContext.newPage();

    // 1. Register both users
    console.log('Registering Owner...');
    await registerUser(ownerPage, ownerData);
    await loginUser(ownerPage, ownerData.email, ownerData.password);

    console.log('Registering Borrower...');
    await registerUser(borrowerPage, borrowerData);
    await loginUser(borrowerPage, borrowerData.email, borrowerData.password);

    // 2. Owner adds a book
    console.log('Owner adding book...');
    await ownerPage.goto('/books');
    await ownerPage.click('text=הוסף ספרים'); // "Add Books" button
    
    await expect(ownerPage).toHaveURL(/\/books\/add/);
    
    // Ensure we are in single book mode
    await ownerPage.getByLabel('single book').click();
    
    // Wait for the manual entry form
    await ownerPage.waitForSelector('form');

    // Fill book details using robust selectors
    await ownerPage.locator('input[name="title"]').fill(bookTitle);
    await ownerPage.locator('input[name="author"]').fill('Test Author');
    await ownerPage.locator('textarea[name="description"]').fill('A test book for the full lifecycle test');
    
    // Handle MUI Select for Genre
    await ownerPage.getByLabel("ז'אנר").click();
    await ownerPage.getByRole('option', { name: 'פנטזיה' }).click();
    
    // Wait for animation/closing
    await ownerPage.waitForTimeout(500);

    // Handle MUI Select for Age Range
    await ownerPage.getByLabel('גיל מומלץ').click({ force: true });
    await ownerPage.getByRole('option', { name: '10-12' }).click();

    // Submit form
    await ownerPage.getByRole('button', { name: 'שמור ספר' }).click();

    // Verify redirection to books list or success message
    await expect(ownerPage).toHaveURL(/.*\/books.*/);
    console.log('Book added successfully');

    // 4. Owner lends the book to Borrower
    console.log('Owner lending book...');
    
    // Ensure we are on the books list
    await ownerPage.goto('/books?view=my');
    await ownerPage.reload(); // Force reload to ensure data is fresh
    
    // Search for the book to filter the list (helps if list is long or loading)
    await ownerPage.getByPlaceholder('חפש לפי שם, מחבר או סדרה').fill(bookTitle);
    await ownerPage.waitForTimeout(1000); // Wait for debounce

    // Find the book card using test id
    const bookCard = ownerPage.getByTestId('catalog-book-card').filter({ hasText: bookTitle }).first();
    await expect(bookCard).toBeVisible({ timeout: 20000 });
    
    // Click "Lend Book" (השאל ספר)
    await bookCard.getByRole('button', { name: 'השאל ספר' }).click();
    
    // Select Borrower Family in the dialog
    // Wait for dialog
    const dialog = ownerPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Wait for families to load (Select to be enabled)
    // Use generic locator for combobox in dialog
    const familySelect = ownerPage.getByRole('dialog').locator('div[role="combobox"]');
    await expect(familySelect).toBeVisible();
    await expect(familySelect).toBeEnabled({ timeout: 10000 });
    
    // Click to open
    await familySelect.click();
    
    // Select the borrower's family
    await ownerPage.getByRole('option', { name: borrowerData.familyName }).click();
    
    // Wait for dropdown to close
    await expect(ownerPage.getByRole('listbox')).toBeHidden();
    
    // Click "Create Loan" (השאל)
    await ownerPage.getByRole('button', { name: 'השאל', exact: true }).click();
    
    // Verify success message or status change
    // The card should now show "Mark as Returned" (סמן כהוחזר)
    await expect(bookCard.getByRole('button', { name: 'סמן כהוחזר' })).toBeVisible();
    console.log('Book lent successfully');

    // 5. Borrower verifies loan
    console.log('Borrower verifying loan...');
    await borrowerPage.goto('/books?view=borrowed');
    
    // Verify book appears in borrower's list
    const borrowerBookCard = borrowerPage.locator('.MuiCard-root', { hasText: bookTitle }).first();
    await expect(borrowerBookCard).toBeVisible();
    await expect(borrowerBookCard).toContainText('שאלתי');
    console.log('Borrower verified loan');

    // 6. Owner marks as returned
    console.log('Owner returning book...');
    await ownerPage.bringToFront();
    
    // Click "Mark as Returned" (סמן כהוחזר)
    await bookCard.getByRole('button', { name: 'סמן כהוחזר' }).click();
    
    // Confirm return in dialog
    // Wait for return dialog
    await expect(ownerPage.getByRole('dialog')).toBeVisible();
    await ownerPage.getByRole('button', { name: 'אשר החזרה' }).click();
    
    // Verify status back to "Lend Book"
    await expect(bookCard.getByRole('button', { name: 'השאל ספר' })).toBeVisible();
    console.log('Book returned successfully');

    // 7. Owner deletes the book
    console.log('Owner deleting book...');
    
    // Go to book details to delete
    await bookCard.getByRole('button', { name: 'פרטים' }).click();
    
    // Click Delete
    await ownerPage.getByRole('button', { name: 'מחק ספר' }).click();
    
    // Confirm delete
    await ownerPage.getByRole('button', { name: 'מחק' }).click();
    
    // Verify redirection to books list
    await expect(ownerPage).toHaveURL(/.*\/books.*/);
    
    // Verify book is gone
    await expect(ownerPage.locator('.MuiCard-root', { hasText: bookTitle })).not.toBeVisible();
    console.log('Book deleted successfully');

    await ownerContext.close();
    await borrowerContext.close();
  });
});
