# E2E Testing Implementation

## Overview
We have implemented a comprehensive End-to-End (E2E) test suite using Playwright to verify the core functionality of the Community Library application.

## Test Files

### 1. `frontend/e2e/utils/auth.ts`
Helper functions for user authentication:
- `generateUserData()`: Creates unique user data (email, name, family name) to avoid collisions.
- `registerUser(page, userData)`: Handles the registration flow, including the multi-step wizard.
- `loginUser(page, email, password)`: Handles the login flow.

### 2. `frontend/e2e/full-lifecycle.spec.ts`
The main integration test that covers the entire lifecycle of a book:
1. **Registration**: Registers two separate users (Owner and Borrower) in isolated browser contexts.
2. **Add Book**: Owner adds a new book manually.
3. **Lend Book**: Owner lends the book to the Borrower using the "Lend Book" dialog.
4. **Verify Loan**: Borrower logs in and verifies the book appears in their "Borrowed Books" list.
5. **Return Book**: Owner marks the book as returned.
6. **Delete Book**: Owner deletes the book to clean up.

## Key Features Tested
- **Authentication**: Registration and Login flows.
- **Book Management**: Adding and Deleting books.
- **Loan Management**: Creating loans, verifying status changes, and returning books.
- **UI Interactions**: Handling Material-UI components like Select dropdowns, Dialogs, and Cards.
- **Real-time Updates**: Verifying state changes across different users.

## How to Run
```bash
# Run the full lifecycle test
npx playwright test e2e/full-lifecycle.spec.ts --project=chromium

# Run with UI mode for debugging
npx playwright test e2e/full-lifecycle.spec.ts --ui
```

## Notes
- The test uses unique user data for each run to ensure isolation.
- Timeouts have been adjusted to handle network latency and UI animations.
- Robust selectors (Role, Label, TestID) are used to ensure stability.
