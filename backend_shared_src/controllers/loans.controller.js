import { db } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Get all loans
 * @route GET /api/loans
 */
export const getAllLoans = asyncHandler(async (req, res) => {
  const { borrowerFamilyId, ownerFamilyId, status, bookId } = req.query;
  const loans = await db.loans.getAll({
    borrowerFamilyId,
    ownerFamilyId,
    status,
    bookId
  });
  res.json({ loans });
});

/**
 * Get loan by ID
 * @route GET /api/loans/:id
 */
export const getLoanById = asyncHandler(async (req, res) => {
  try {
    const loan = await db.loans.getById(req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    res.json({ loan });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('invalid input syntax')) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    throw error;
  }
});

/**
 * Create a new loan
 * @route POST /api/loans
 */
export const createLoan = asyncHandler(async (req, res) => {
  console.log('Creating loan with payload:', req.body);

  // Validate required fields
  const bookId = req.body.family_book_id || req.body.book_id;
  if (!bookId || !req.body.borrower_family_id) {
    return res.status(400).json({ error: 'family_book_id and borrower_family_id are required' });
  }

  // Convert book_id to family_book_id if needed
  if (req.body.book_id && !req.body.family_book_id) {
    req.body.family_book_id = req.body.book_id;
  }

  // Always create loans with active status
  req.body.status = 'active';
  
  // Log if client provided a loan ID (for frontend-generated UUIDs)
  if (req.body.id) {
    console.log('Using client-provided loan ID:', req.body.id);
  }

  try {
    const loan = await db.loans.create(req.body);
    console.log('Loan created successfully:', loan.id);

    // Update book status to on_loan
    console.log('Updating book status for family_book_id:', bookId);
    try {
      await db.books.update(bookId, { status: 'on_loan' });
      console.log('Book status updated to on_loan');
    } catch (bookUpdateError) {
      console.error('Error updating book status:', bookUpdateError);
      // Don't fail the whole operation if book update fails
      // The loan was created successfully
    }

    res.status(201).json({ loan });
  } catch (error) {
    console.error('Error creating loan:', error);
    
    if (error.code === '23503') {
      // Foreign key violation
      return res.status(400).json({ error: 'Invalid family_book_id or borrower_family_id' });
    }
    
    throw error;
  }
});

/**
 * Update a loan
 * @route PUT /api/loans/:id
 */
export const updateLoan = asyncHandler(async (req, res) => {
  try {
    const loan = await db.loans.update(req.params.id, req.body);
    if (!loan) {
      return res.status(400).json({ error: 'Loan not found' });
    }

    // Update book status based on loan status
    if (loan.family_book_id) {
      try {
        if (req.body.status === 'active') {
          await db.books.update(loan.family_book_id, { status: 'on_loan' });
        } else if (req.body.status === 'returned') {
          await db.books.update(loan.family_book_id, { status: 'available' });
        }
      } catch (bookError) {
        // Log but don't fail - loan was updated successfully
        console.error('Note: Could not update book status:', bookError.message || bookError);
      }
    }

    res.json({ loan });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Loan not found' });
    }
    throw error;
  }
});
