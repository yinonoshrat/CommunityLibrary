import { db, supabase } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';
import { searchBookDetails } from '../services/bookSearch.js';

// AI Vision Service (will be injected by router)
let aiVisionService = null;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const isValidUUID = (value = '') => UUID_REGEX.test(value);

const validateRating = (value, { required = true } = {}) => {
  if (value === undefined || value === null) {
    return required ? 'Rating is required' : null;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Rating must be a number';
  }
  if (value < 1 || value > 5) {
    return 'Rating must be between 1 and 5';
  }
  return null;
};

const sanitizeReviewText = (value = '') => value.trim();

const resolveCatalogId = async (bookId) => {
  const { data, error } = await supabase
    .from('family_books')
    .select('book_catalog_id')
    .eq('id', bookId)
    .maybeSingle();

  if (data?.book_catalog_id) {
    return data.book_catalog_id;
  }

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return bookId;
};

/**
 * Initialize AI Vision Service
 * Called by router during setup
 */
export function setAiVisionService(service) {
  aiVisionService = service;
}

/**
 * Helper function to parse number parameters
 */
function parseNumberParam(value) {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Normalize loan record for consistent format
 */
function normalizeLoanRecord(loan) {
  return {
    id: loan.id,
    status: loan.status,
    familyBookId: loan.family_book_id,
    borrowerFamilyId: loan.borrower_family_id,
    ownerFamilyId: loan.owner_family_id,
    dueDate: loan.due_date,
    requestDate: loan.request_date || loan.created_at,
    approvedDate: loan.approved_date,
    returnDate: loan.return_date,
    borrowerFamily: loan.borrower_families
      ? {
          id: loan.borrower_families.id,
          name: loan.borrower_families.name,
          phone: loan.borrower_families.phone,
          whatsapp: loan.borrower_families.whatsapp,
        }
      : null,
    ownerFamily: loan.owner_families
      ? {
          id: loan.owner_families.id,
          name: loan.owner_families.name,
          phone: loan.owner_families.phone,
          whatsapp: loan.owner_families.whatsapp,
        }
      : null,
  };
}

/**
 * Group books by catalog for response
 */
function groupBooksForResponse({ books, loanMap, likesMap, viewerFamilyId, view, sortBy }) {
  const catalogMap = new Map();

  for (const book of books) {
    const catalogId = book.book_catalog_id;
    if (!catalogId) continue;

    if (!catalogMap.has(catalogId)) {
      catalogMap.set(catalogId, {
        catalogId,
        title: book.title,
        titleHebrew: book.title_hebrew,
        author: book.author,
        authorHebrew: book.author_hebrew,
        isbn: book.isbn,
        publisher: book.publisher,
        publishYear: book.publish_year,
        genre: book.genre,
        ageRange: book.age_range,
        pages: book.pages,
        description: book.description,
        coverImageUrl: book.cover_image_url,
        series: book.series,
        seriesNumber: book.series_number,
        viewerContext: {
          ownedCopies: [],
          owns: false,
          borrowed: false,
          borrowedLoan: null,
        },
        owners: [],
        stats: {
          totalCopies: 0,
          availableCopies: 0,
          totalLikes: likesMap.get(catalogId) || 0,
        },
      });
    }

    const entry = catalogMap.get(catalogId);
    entry.stats.totalCopies++;

    const loan = loanMap.get(book.id);
    const isAvailable = book.status === 'available' && !loan;
    if (isAvailable) {
      entry.stats.availableCopies++;
    }

    const ownerRecord = {
      familyBookId: book.id,
      status: book.status,
      condition: book.condition,
      notes: book.notes,
      familyId: book.family_id,
      family: book.families
        ? {
            id: book.families.id,
            name: book.families.name,
            phone: book.families.phone,
            whatsapp: book.families.whatsapp,
          }
        : null,
      loan: loan || null,
      isViewerOwner: book.family_id === viewerFamilyId,
    };

    entry.owners.push(ownerRecord);

    if (book.family_id === viewerFamilyId) {
      entry.viewerContext.owns = true;
      entry.viewerContext.ownedCopies.push({
        familyBookId: book.id,
        status: book.status,
        loan: loan || null,
      });
    }

    if (loan && loan.borrowerFamilyId === viewerFamilyId) {
      entry.viewerContext.borrowed = true;
      entry.viewerContext.borrowedLoan = loan;
    }
  }

  let grouped = Array.from(catalogMap.values());

  // Sort owners within each catalog entry
  for (const entry of grouped) {
    entry.owners.sort((a, b) => {
      if (a.isViewerOwner !== b.isViewerOwner) {
        return a.isViewerOwner ? -1 : 1;
      }
      return (a.family?.name || '').localeCompare(b.family?.name || '', 'he');
    });
  }

  // Sort catalog entries
  if (sortBy === 'updated') {
    grouped.sort((a, b) => {
      const aMax = Math.max(...a.owners.map((o) => new Date(o.updatedAt || 0).getTime()));
      const bMax = Math.max(...b.owners.map((o) => new Date(o.updatedAt || 0).getTime()));
      return bMax - aMax;
    });
  } else {
    grouped.sort((a, b) => {
      const titleA = a.title || a.titleHebrew || '';
      const titleB = b.title || b.titleHebrew || '';
      return titleA.localeCompare(titleB, 'he');
    });
  }

  return grouped;
}

/**
 * Get all books with optional filters
 * @route GET /api/books
 */
export const getAllBooks = asyncHandler(async (req, res) => {
  const {
    familyId: familyIdQuery,
    view: viewQuery,
    scope: scopeQuery,
    status,
    title,
    author,
    genre,
    series,
    ageRange,
    search,
    q,
    limit,
    offset,
    sortBy,
  } = req.query;

  const userId = req.userId;
  const familyIdHeader = req.familyId;
  const view = (viewQuery || scopeQuery || (familyIdQuery ? 'my' : 'all') || 'my').toString();

  let viewerFamilyId = familyIdQuery || familyIdHeader || null;
  if (!viewerFamilyId && userId) {
    try {
      const viewerUser = await db.users.getById(userId);
      viewerFamilyId = viewerUser?.family_id || null;
    } catch (err) {
      console.warn('Unable to resolve viewer family:', err.message);
    }
  }

  if ((view === 'my' || view === 'borrowed') && !viewerFamilyId) {
    return res.json({
      books: [],
      meta: {
        total: 0,
        view,
        message: 'לא נמצאה משפחה משויכת. אנא הצטרף או צור משפחה כדי לראות ספרים.',
      },
    });
  }

  const filters = {
    title,
    author,
    genre,
    series,
    ageRange,
    search: search || q,
    limit: parseNumberParam(limit),
    offset: parseNumberParam(offset),
    orderBy: sortBy === 'updated' ? 'updated_at' : 'title',
    orderDir: sortBy === 'updated' ? 'desc' : 'asc',
  };

  if (status) {
    if (status.includes(',')) {
      filters.status = status.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (status !== 'all') {
      filters.status = status;
    }
  }

  let loanMap = new Map();

  if (view === 'my') {
    filters.familyId = viewerFamilyId;
  } else if (view === 'borrowed') {
    const borrowedLoans = await db.loans.getAll({ borrowerFamilyId: viewerFamilyId, status: 'active' });
    if (!borrowedLoans.length) {
      return res.json({ books: [], meta: { total: 0, view } });
    }

    const borrowedIds = borrowedLoans.map((loan) => loan.family_book_id).filter(Boolean);
    filters.ids = borrowedIds;

    loanMap = new Map(
      borrowedLoans
        .filter((loan) => loan.family_book_id)
        .map((loan) => [loan.family_book_id, normalizeLoanRecord(loan)])
    );
  }

  if (!filters.limit && view === 'all') {
    filters.limit = 100;
  }

  const books = await db.books.getAll(filters);

  const missingLoanIds = books.map((book) => book.id).filter((id) => id && !loanMap.has(id));

  if (missingLoanIds.length) {
    const activeLoans = await db.loans.getAll({ bookIds: missingLoanIds, status: 'active' });
    activeLoans.forEach((loan) => {
      if (loan.family_book_id) {
        loanMap.set(loan.family_book_id, normalizeLoanRecord(loan));
      }
    });
  }

  // Fetch likes count for all catalog IDs in one query
  const catalogIds = [...new Set(books.map((b) => b.book_catalog_id).filter(Boolean))];
  const likesMap = new Map();
  if (catalogIds.length > 0) {
    const { data: likesData } = await supabase
      .from('likes')
      .select('book_catalog_id')
      .in('book_catalog_id', catalogIds);

    if (likesData) {
      for (const like of likesData) {
        likesMap.set(like.book_catalog_id, (likesMap.get(like.book_catalog_id) || 0) + 1);
      }
    }
  }

  const grouped = groupBooksForResponse({
    books,
    loanMap,
    likesMap,
    viewerFamilyId,
    view,
    sortBy,
  });

  res.json({
    books: grouped,
    meta: {
      total: grouped.length,
      view,
    },
  });
});

/**
 * Search books in catalog
 * @route GET /api/books/search
 */
export const searchBooks = asyncHandler(async (req, res) => {
  const { q, genre, ageLevel, available } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const query = supabase.from('book_catalog').select('*');

  // Full-text search on title and author
  query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);

  if (genre) {
    query.eq('genre', genre);
  }

  if (ageLevel) {
    query.eq('age_level', ageLevel);
  }

  const { data: books, error } = await query.limit(50);

  if (error) {
    console.error('Error searching books:', error);
    return res.status(500).json({ error: 'Failed to search books' });
  }

  // If available filter requested, check for available family_books
  if (available === 'true') {
    const bookIds = books.map((b) => b.id);
    const { data: familyBooks } = await supabase
      .from('family_books')
      .select('book_catalog_id, status')
      .in('book_catalog_id', bookIds)
      .eq('status', 'available');

    const availableIds = new Set(familyBooks?.map((fb) => fb.book_catalog_id) || []);
    return res.json({ books: books.filter((b) => availableIds.has(b.id)) });
  }

  res.json({ books });
});

/**
 * Get book by ID
 * @route GET /api/books/:id
 */
export const getBookById = asyncHandler(async (req, res) => {
  try {
    const book = await db.books.getById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ book });
  } catch (error) {
    // Handle invalid UUID or other database errors
    if (error.code === 'PGRST116' || error.message?.includes('invalid input syntax')) {
      return res.status(404).json({ error: 'Book not found' });
    }
    throw error;
  }
});

/**
 * Get all families that have a specific book
 * @route GET /api/books/:id/families
 */
export const getBookFamilies = asyncHandler(async (req, res) => {
  // First get the family_book to get its book_catalog_id
  const { data: familyBook, error: fbError } = await supabase
    .from('family_books')
    .select('book_catalog_id')
    .eq('id', req.params.id)
    .single();

  if (fbError) {
    if (fbError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Book not found' });
    }
    throw fbError;
  }

  const catalogId = familyBook.book_catalog_id;

  // Get the book catalog entry
  const { data: book, error: bookError } = await supabase
    .from('book_catalog')
    .select('*')
    .eq('id', catalogId)
    .single();

  if (bookError) throw bookError;

  // Find all family_books with this catalog entry
  const { data: familyBooks, error } = await supabase
    .from('family_books')
    .select(
      `
      id,
      status,
      notes,
      families:family_id (
        id,
        name,
        phone,
        whatsapp
      )
    `
    )
    .eq('book_catalog_id', catalogId);

  if (error) {
    console.error('Error fetching book families:', error);
    return res.status(500).json({ error: 'Failed to fetch book families' });
  }

  // Check loan status for each
  const results = await Promise.all(
    familyBooks.map(async (fb) => {
      const { data: loans } = await supabase
        .from('loans')
        .select('*')
        .eq('family_book_id', fb.id)
        .eq('status', 'active')
        .maybeSingle();

      return {
        familyBookId: fb.id,
        family: fb.families,
        status: fb.status,
        isAvailable: fb.status === 'available' && !loans,
        currentLoan: loans || null,
      };
    })
  );

  res.json({ book, families: results });
});

/**
 * Create a new book
 * @route POST /api/books
 */
export const createBook = asyncHandler(async (req, res) => {
  // Validate required fields
  if (!req.body.title || !req.body.author) {
    return res.status(400).json({ error: 'Title and author are required' });
  }
  
  const book = await db.books.create(req.body);
  res.status(201).json({ book });
});

/**
 * Update a book
 * @route PUT /api/books/:id
 */
export const updateBook = asyncHandler(async (req, res) => {
  try {
    const book = await db.books.update(req.params.id, req.body);
    if (!book) {
      return res.status(400).json({ error: 'Book not found or access denied' });
    }
    res.json({ book });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('invalid input syntax') || error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Book not found or access denied' });
    }
    throw error;
  }
});

/**
 * Delete a book
 * @route DELETE /api/books/:id
 */
export const deleteBook = asyncHandler(async (req, res) => {
  try {
    await db.books.delete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    if (error.message?.includes('not found') || error.code === 'PGRST116') {
      return res.status(400).json({ error: 'Book not found or access denied' });
    }
    throw error;
  }
});

/**
 * Get all reviews for a book
 * @route GET /api/books/:bookId/reviews
 */
export const getBookReviews = asyncHandler(async (req, res) => {
  try {
    const reviews = await db.reviews.getByBookId(req.params.bookId);
    res.json({ reviews });
  } catch (error) {
    console.error('Failed to fetch book reviews:', error);
    res.status(500).json({ error: 'Failed to fetch book reviews' });
  }
});

/**
 * Create a review for a book
 * @route POST /api/books/:bookId/reviews
 */
export const createBookReview = asyncHandler(async (req, res) => {
  // Get user_id from header (preferred) or body (for backwards compatibility)
  const userId = req.userId || req.body.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  if (!isValidUUID(req.params.bookId)) {
    return res.status(400).json({ error: 'Invalid book ID' });
  }

  const ratingError = validateRating(req.body.rating);
  if (ratingError) {
    return res.status(400).json({ error: ratingError });
  }

  const reviewText = sanitizeReviewText(req.body.review_text);
  if (!reviewText) {
    return res.status(400).json({ error: 'Review text is required' });
  }

  try {
    const catalogId = await resolveCatalogId(req.params.bookId);

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('book_catalog_id', catalogId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'User has already reviewed this book' });
    }

    const review = await db.reviews.create({
      book_id: req.params.bookId,
      user_id: userId,
      rating: req.body.rating,
      review_text: reviewText,
    });

    res.status(201).json({ review });
  } catch (error) {
    console.error('Failed to create review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

/**
 * Update an existing review
 * @route PUT /api/reviews/:id
 */
export const updateReview = asyncHandler(async (req, res) => {
  const { rating, review_text } = req.body;

  if (rating === undefined && review_text === undefined) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  const ratingError = validateRating(rating, { required: false });
  if (ratingError) {
    return res.status(400).json({ error: ratingError });
  }

  const updates = {};
  if (rating !== undefined) {
    updates.rating = rating;
  }
  if (review_text !== undefined) {
    const text = sanitizeReviewText(review_text);
    if (!text) {
      return res.status(400).json({ error: 'Review text cannot be empty' });
    }
    updates.review_text = text;
  }

  try {
    const review = await db.reviews.update(req.params.id, updates);
    res.json({ review });
  } catch (error) {
    console.error('Failed to update review:', error);
    res.status(400).json({ error: error.message || 'Failed to update review' });
  }
});

/**
 * Delete a review
 * @route DELETE /api/reviews/:id
 */
export const deleteReview = asyncHandler(async (req, res) => {
  try {
    await db.reviews.delete(req.params.id);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Failed to delete review:', error);
    res.status(400).json({ error: error.message || 'Failed to delete review' });
  }
});

/**
 * Get likes for a book
 * @route GET /api/books/:bookId/likes
 */
export const getBookLikes = asyncHandler(async (req, res) => {
  try {
    const likes = await db.likes.getByBookId(req.params.bookId);
    res.json({ likes, count: likes.length });
  } catch (error) {
    console.error('Failed to fetch book likes:', error);
    res.status(500).json({ error: 'Failed to fetch book likes' });
  }
});

/**
 * Toggle like for a book
 * @route POST /api/books/:bookId/likes
 */
export const toggleBookLike = asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!isValidUUID(req.params.bookId)) {
    return res.status(400).json({ error: 'Invalid book ID' });
  }

  try {
    const result = await db.likes.toggle(req.params.bookId, user_id);
    res.json(result);
  } catch (error) {
    console.error('Failed to toggle book like:', error);
    res.status(400).json({ error: 'Failed to toggle book like' });
  }
});

/**
 * Detect books from uploaded image using AI
 * @route POST /api/books/detect-from-image
 */
export const detectBooksFromImage = asyncHandler(async (req, res) => {
  console.log('=== DETECT FROM IMAGE REQUEST ===');
  console.log('Has GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);
  console.log('aiVisionService initialized:', !!aiVisionService);
  console.log('Request file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : 'NO FILE');

  // Check if AI service is available
  if (!aiVisionService) {
    console.error('AI service not initialized. Check GEMINI_API_KEY environment variable.');
    return res.status(503).json({
      error: 'AI vision service not configured',
      message: 'GEMINI_API_KEY environment variable is missing'
    });
  }

  // Check if image was uploaded
  if (!req.file) {
    console.error('No image file in request');
    return res.status(400).json({ error: 'No image provided' });
  }

  // Validate file is an image (in case fileFilter passed it through)
  if (!req.file.mimetype.startsWith('image/')) {
    console.error('Non-image file rejected:', req.file.mimetype);
    return res.status(400).json({ error: 'Only image files are allowed' });
  }

  console.log(`Processing image: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

  // Detect books using AI
  const detectedBooks = await aiVisionService.detectBooksFromImage(req.file.buffer);

  console.log(`Successfully detected ${detectedBooks.length} books, starting online search...`);

  // Search for book details in parallel
  const bookSearchPromises = detectedBooks.map(async (book) => {
    try {
      const bookDetails = await searchBookDetails(book.title, book.author);

      if (bookDetails && bookDetails.confidence >= 70) {
        // High confidence - merge all details
        return {
          ...book,
          ...bookDetails,
          confidence: 'high',
          confidenceScore: bookDetails.confidence
        };
      } else if (bookDetails && bookDetails.confidence >= 40) {
        // Medium confidence - merge but keep original title/author
        const rawSeriesNumber = book.series_number ?? bookDetails.series_number;
        const seriesNumber = rawSeriesNumber === null || rawSeriesNumber === undefined
          ? null
          : Number.isFinite(Number(rawSeriesNumber))
            ? Number(rawSeriesNumber)
            : parseInt(String(rawSeriesNumber).match(/\d+/)?.[0] || '', 10);

        return {
          title: book.title,
          author: book.author || bookDetails.author,
          publisher: bookDetails.publisher,
          publish_year: bookDetails.publish_year,
          pages: bookDetails.pages,
          description: bookDetails.description,
          cover_image_url: bookDetails.cover_image_url,
          isbn: bookDetails.isbn,
          genre: bookDetails.genre,
          age_range: bookDetails.age_range,
          language: bookDetails.language,
          series: book.series || bookDetails.series,
          series_number: seriesNumber === null || Number.isNaN(seriesNumber) ? null : seriesNumber,
          confidence: 'medium',
          confidenceScore: bookDetails.confidence
        };
      } else {
        // Low confidence - keep AI detected data only
        return {
          ...book,
          confidence: 'low',
          confidenceScore: bookDetails?.confidence || 0
        };
      }
    } catch (error) {
      console.error(`Search error for "${book.title}":`, error.message);
      return {
        ...book,
        confidence: 'low',
        confidenceScore: 0
      };
    }
  });

  const enrichedBooks = await Promise.all(bookSearchPromises);

  // Sort by confidence (high first, then medium, then low)
  const sortedBooks = enrichedBooks.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const orderDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (orderDiff !== 0) return orderDiff;
    // Within same confidence level, sort by confidence score
    return b.confidenceScore - a.confidenceScore;
  });

  console.log(`Enriched ${sortedBooks.length} books with online data`);
  console.log(`High confidence: ${sortedBooks.filter(b => b.confidence === 'high').length}`);
  console.log(`Medium confidence: ${sortedBooks.filter(b => b.confidence === 'medium').length}`);
  console.log(`Low confidence: ${sortedBooks.filter(b => b.confidence === 'low').length}`);

  res.json({
    success: true,
    books: sortedBooks,
    count: sortedBooks.length
  });
});

/**
 * Bulk add books to catalog
 * @route POST /api/books/bulk-add
 */
export const bulkAddBooks = asyncHandler(async (req, res) => {
  const { books } = req.body;

  // Validate input first (before auth check)
  if (!books) {
    return res.status(400).json({ error: 'No books provided' });
  }

  if (!Array.isArray(books) || books.length === 0) {
    return res.status(400).json({ error: 'No books provided' });
  }

  const userId = req.userId; // From auth middleware

  // Get user's family ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    return res.status(401).json({ error: 'User not found' });
  }

  const familyId = userData.family_id;

  if (books.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 books per batch' });
  }

  // Validate and add each book
  const addedBooks = [];
  const skippedBooks = [];
  const errors = [];

  // Process books in parallel for better performance
  const results = await Promise.allSettled(
    books.map(async (book) => {
      // Basic validation
      if (!book.title || typeof book.title !== 'string') {
        throw new Error('Missing or invalid title');
      }

      // Prepare book data
      // Validate ISBN: convert 0, '0', empty string, or partial ISBN to null
      // Valid ISBNs are 10 or 13 digits
      let cleanIsbn = book.isbn;
      if (!cleanIsbn || cleanIsbn === 0 || cleanIsbn === '0' || cleanIsbn === '' || String(cleanIsbn).length < 10) {
        cleanIsbn = null;
      }

      const bookData = {
        title: book.title.trim(),
        author: book.author ? book.author.trim() : 'לא ידוע',
        family_id: familyId,
        status: 'available',
        genre: book.genre || null,
        age_range: book.age_range || null,
        publish_year: book.publish_year || null,
        publisher: book.publisher || null,
        pages: book.pages || null,
        description: book.description || null,
        cover_image_url: book.cover_image_url || null,
        isbn: cleanIsbn,
        series: book.series || null,
        series_number: book.series_number || null
      };

      // Insert book using adapter (handles deduplication in catalog)
      const data = await db.books.create(bookData);

      return { book, data };
    })
  );

  // Process results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalBook = books[i];

    if (result.status === 'fulfilled') {
      const { data } = result.value;

      // Check if book was already owned
      if (data._alreadyOwned) {
        skippedBooks.push({
          title: data.title,
          author: data.author,
          reason: 'already_owned'
        });
      } else {
        addedBooks.push(data);
      }
    } else {
      console.error('Book processing error:', result.reason);
      errors.push({
        book: originalBook,
        error: result.reason?.message || 'Unknown error'
      });
    }
  }

  res.json({
    success: true,
    added: addedBooks.length,
    skipped: skippedBooks.length,
    failed: errors.length,
    books: addedBooks,
    skippedBooks: skippedBooks,
    errors: errors
  });
});
