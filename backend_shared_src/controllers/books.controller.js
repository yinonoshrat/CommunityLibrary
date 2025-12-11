import { db, supabase } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';
import { searchBookDetails } from '../services/bookSearch.js';
import { DETECTION_ERROR_CODES, getErrorResponse } from '../constants/detectionErrors.js';
import {
  generateThumbnail,
  uploadImageToStorage,
  validateImageFile
} from '../services/storageService.js';

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
    borrowerFamily: loan.borrower_family
      ? {
          id: loan.borrower_family.id,
          name: loan.borrower_family.name,
          phone: loan.borrower_family.phone,
          whatsapp: loan.borrower_family.whatsapp,
        }
      : null,
    ownerFamily: loan.owner_family
      ? {
          id: loan.owner_family.id,
          name: loan.owner_family.name,
          phone: loan.owner_family.phone,
          whatsapp: loan.owner_family.whatsapp,
        }
      : null,
  };
}

/**
 * Group books by catalog for response
 */
function groupBooksForResponse({ books, loanMap, likesMap, userLikesSet, viewerFamilyId, view, sortBy }) {
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
          userLiked: userLikesSet ? userLikesSet.has(catalogId) : false,
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
  const perfStart = Date.now();
  const timings = {};
  
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
    userId: userIdQuery,
  } = req.query;

  // Use userId from middleware (auth) or query param
  const userId = req.userId || userIdQuery;
  const familyIdHeader = req.familyId;
  const view = (viewQuery || scopeQuery || (familyIdQuery ? 'my' : 'all') || 'my').toString();

  let t1 = Date.now();
  let viewerFamilyId = familyIdQuery || familyIdHeader || null;
  if (!viewerFamilyId && userId) {
    try {
      const viewerUser = await db.users.getById(userId);
      viewerFamilyId = viewerUser?.family_id || null;
    } catch (err) {
      console.warn('Unable to resolve viewer family:', err.message);
    }
  }
  timings.getUserFamily = Date.now() - t1;

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
    t1 = Date.now();
    const borrowedLoans = await db.loans.getAll({ borrowerFamilyId: viewerFamilyId, status: 'active' });
    timings.getBorrowedLoans = Date.now() - t1;
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

  t1 = Date.now();
  const books = await db.books.getAll(filters);
  timings.getBooksQuery = Date.now() - t1;

  t1 = Date.now();
  const missingLoanIds = books.map((book) => book.id).filter((id) => id && !loanMap.has(id));

  if (missingLoanIds.length) {
    const activeLoans = await db.loans.getAll({ bookIds: missingLoanIds, status: 'active' });
    activeLoans.forEach((loan) => {
      if (loan.family_book_id) {
        loanMap.set(loan.family_book_id, normalizeLoanRecord(loan));
      }
    });
  }

  // Fetch likes count and user's like status for all catalog IDs in parallel
  t1 = Date.now();
  const catalogIds = [...new Set(books.map((b) => b.book_catalog_id).filter(Boolean))];
  const likesMap = new Map();
  const userLikesSet = new Set();
  
  if (catalogIds.length > 0) {
    // Use RPC call for efficient aggregated likes count
    const likesPromises = [
      // Get counts grouped by book_catalog_id (much faster than fetching all rows)
      supabase.rpc('get_likes_counts', { catalog_ids: catalogIds }),
      // Check if current user liked each book (only fetch user's likes)
      userId
        ? supabase
            .from('likes')
            .select('book_catalog_id')
            .in('book_catalog_id', catalogIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] }),
    ];

    const [likesCountResult, userLikesResult] = await Promise.all(likesPromises);

    // If RPC doesn't exist yet, fall back to old method
    if (likesCountResult.error && likesCountResult.error.code === '42883') {
      // Function doesn't exist, use old method
      const { data: allLikes } = await supabase
        .from('likes')
        .select('book_catalog_id')
        .in('book_catalog_id', catalogIds);
      
      if (allLikes) {
        for (const like of allLikes) {
          likesMap.set(like.book_catalog_id, (likesMap.get(like.book_catalog_id) || 0) + 1);
        }
      }
    } else if (likesCountResult.data) {
      // Use the aggregated counts from RPC
      for (const row of likesCountResult.data) {
        likesMap.set(row.book_catalog_id, row.like_count);
      }
    }

    if (userLikesResult.data) {
      for (const like of userLikesResult.data) {
        userLikesSet.add(like.book_catalog_id);
      }
    }
  }
  timings.getLikes = Date.now() - t1;

  t1 = Date.now();
  const grouped = groupBooksForResponse({
    books,
    loanMap,
    likesMap,
    userLikesSet,
    viewerFamilyId,
    view,
    sortBy,
  });
  timings.groupBooks = Date.now() - t1;

  const totalTime = Date.now() - perfStart;
  if (totalTime > 500) {
    console.warn(`⚠️  getAllBooks SLOW: ${totalTime}ms`, timings);
  }

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
  const perfStart = Date.now();
  const timings = {};
  
  try {
    const t1 = Date.now();
    const book = await db.books.getById(req.params.id);
    timings.getBookById = Date.now() - t1;
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Add like stats for the book
    const userId = req.query.user_id;
    
    if (book.book_catalog_id && userId) {
      // Combine both queries into a single query for better performance
      const t2 = Date.now();
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('id, user_id')
        .eq('book_catalog_id', book.book_catalog_id);
      timings.likesQuery = Date.now() - t2;

      if (likesError) throw likesError;

      // Calculate stats from the single query result
      const totalLikes = likesData?.length || 0;
      const userLiked = likesData?.some(like => like.user_id === userId) || false;

      // Add stats to book object
      book.stats = {
        ...book.stats,
        totalLikes,
        userLiked
      };
    }

    const totalTime = Date.now() - perfStart;
    if (totalTime > 500) {
      console.warn(`⚠️  getBookById SLOW: ${totalTime}ms`, timings);
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
  
  try {
    const book = await db.books.create(req.body);
    res.status(201).json({ book });
  } catch (error) {
    console.error('Error creating book:', error);
    console.error('Request body:', req.body);
    throw error;
  }
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
  const perfStart = Date.now();
  try {
    const reviews = await db.reviews.getByBookId(req.params.bookId);
    const duration = Date.now() - perfStart;
    if (duration > 500) {
      console.warn(`⚠️  getBookReviews SLOW: ${duration}ms for bookId=${req.params.bookId}`);
    }
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
 * Detect books from uploaded image using AI (ASYNC with Supabase Edge Function)
 * @route POST /api/books/detect-from-image
 */
export const detectBooksFromImage = asyncHandler(async (req, res) => {
  console.log('=== ASYNC DETECT FROM IMAGE REQUEST ===');
  console.log('User ID:', req.user?.id);
  console.log('Request file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : 'NO FILE');

  // Check if image was uploaded
  if (!req.file) {
    console.error('No image file in request');
    return res.status(400).json({ error: 'No image provided' });
  }

  // Validate file
  const validation = validateImageFile(req.file);
  if (!validation.valid) {
    console.error('File validation failed:', validation.error);
    return res.status(400).json({ error: validation.error });
  }

  // Validate user authentication
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  console.log(`Processing image: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

  // Convert image buffer to base64
  const imageBase64 = req.file.buffer.toString('base64');
  const imageBuffer = req.file.buffer;

  // Generate thumbnail for database display
  let imageThumbnail = null;
  try {
    imageThumbnail = await generateThumbnail(imageBuffer);
  } catch (err) {
    console.warn('Thumbnail generation failed:', err.message);
    // Continue without thumbnail - not critical
  }

  // Create job in database
  const { supabase: supabaseClient } = await import('../db/adapter.js');
  const { data: job, error: jobError } = await supabaseClient
    .from('detection_jobs')
    .insert({
      user_id: req.user.id,
      status: 'processing',
      image_data: imageBase64,
      image_original_filename: req.file.originalname,
      image_mime_type: req.file.mimetype,
      image_size_bytes: req.file.size,
      image_base64_thumbnail: imageThumbnail,
      image_uploaded_at: new Date().toISOString(),
      progress: 0,
      stage: 'uploading'
    })
    .select()
    .single();

  if (jobError) {
    console.error('[detectBooksFromImage] Failed to create detection job:', jobError);
    console.error('[detectBooksFromImage] Error details:', JSON.stringify(jobError, null, 2));
    return res.status(500).json({ error: 'Failed to create detection job' });
  }

  console.log(`[detectBooksFromImage] ✓ Created detection job: ${job.id}`);

  // Upload image to Supabase Storage (async, don't wait)
  (async () => {
    try {
      console.log(`[detectBooksFromImage] Uploading image to storage for job: ${job.id}`);
      
      const storageResult = await uploadImageToStorage(
        supabaseClient,
        req.user.id,
        job.id,
        imageBuffer,
        req.file.mimetype
      );

      // Update job with storage paths and signed URL
      const { error: updateError } = await supabaseClient
        .from('detection_jobs')
        .update({
          image_storage_path: storageResult.path,
          image_storage_url: storageResult.url,
          progress: 15,
          stage: 'extracting_text',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        console.error(`[detectBooksFromImage] Failed to update storage paths: ${updateError.message}`);
      } else {
        console.log(`[detectBooksFromImage] ✓ Image uploaded: ${storageResult.path}`);
      }
    } catch (uploadErr) {
      console.error(`[detectBooksFromImage] ✗ Image upload failed: ${uploadErr.message}`);
      // Continue - image storage is nice-to-have but not critical
    }
  })();

  if (jobError) {
    console.error('[detectBooksFromImage] Failed to create detection job:', jobError);
    console.error('[detectBooksFromImage] Error details:', JSON.stringify(jobError, null, 2));
    return res.status(500).json({ error: 'Failed to create detection job' });
  }

  console.log(`[detectBooksFromImage] ✓ Created detection job: ${job.id}`);

  // Check if we should run locally or use edge function
  const runLocally = process.env.RUN_DETECTION_LOCALLY === 'true';
  
  if (runLocally) {
    console.log('[detectBooksFromImage] Running detection LOCALLY (RUN_DETECTION_LOCALLY=true)');
    
    // Run detection in the same process (async, don't wait)
    (async () => {
      try {
        console.log(`[detectBooksFromImage] Starting local detection for job: ${job.id}`);
        
        // Progress callback function - updates job status in database
        const onProgress = async (stage, percentage, message) => {
          console.log(`[detectBooksFromImage] Progress: ${stage} - ${percentage}% - ${message}`);
          
          try {
            const updateData = {
              stage,
              progress: percentage,
              updated_at: new Date().toISOString()
            };
            
            // Add error code if this is a failure stage
            if (stage.startsWith('failed_')) {
              updateData.stage = stage;
            }
            
            await supabase
              .from('detection_jobs')
              .update(updateData)
              .eq('id', job.id);
          } catch (updateErr) {
            console.error(`[detectBooksFromImage] Failed to update progress: ${updateErr.message}`);
          }
        };

        // Detect books using AI with progress callbacks
        const detectionResult = await aiVisionService.detectBooksFromImage(
          Buffer.from(imageBase64, 'base64'),
          { onProgress }
        );
        
        // Check if detection had an error
        if (detectionResult.errorCode) {
          console.error(`[detectBooksFromImage] Detection failed: ${detectionResult.errorCode} - ${detectionResult.errorMessage}`);
          
          const { error: updateError } = await supabase
            .from('detection_jobs')
            .update({
              status: 'failed',
              error_code: detectionResult.errorCode,
              error: detectionResult.errorMessage,
              can_retry: detectionResult.canRetry,
              stage: 'failed_ai',
              progress: 0,
              image_analysis_metadata: detectionResult.metadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
          
          if (updateError) {
            console.error(`[detectBooksFromImage] Failed to update job with error: ${updateError.message}`);
          }
          return;
        }
        
        const detectedBooks = detectionResult.books || [];
        console.log(`[detectBooksFromImage] Detected ${detectedBooks.length} books locally`);
        
        // Continue with book search and enrichment (60-80%)
        // Search for book details (60-80% progress)
        if (detectedBooks.length > 0) {
          await onProgress('enriching_metadata', 60, `Searching database for ${detectedBooks.length} books...`);
          
          const { searchBookDetails } = await import('../services/bookSearch.js');
          const bookSearchPromises = detectedBooks.map(async (book) => {
            try {
              const bookDetails = await searchBookDetails(book.title, book.author);
              if (bookDetails && bookDetails.confidence >= 70) {
                return { ...book, ...bookDetails };
              }
              return book;
            } catch (err) {
              console.error(`[detectBooksFromImage] Search failed for ${book.title}:`, err.message);
              return book;
            }
          });

          const enrichedBooks = await Promise.all(bookSearchPromises);
          
          // Check ownership status (80-95%)
          await onProgress('checking_ownership', 80, `Checking your book catalog...`);
          
          console.log(`[detectBooksFromImage] Checking ownership for user ${req.user.id}...`);
          
          // Initialize all books with alreadyOwned: false
          enrichedBooks.forEach(book => {
            book.alreadyOwned = false;
          });

          try {
            // Get user's family
            const { data: familyData, error: familyError } = await supabase
              .from('users')
              .select('family_id')
              .eq('id', req.user.id)
              .single();

            if (familyError) {
              console.log(`[detectBooksFromImage] User lookup warning: ${familyError.message} - skipping ownership check`);
            } else if (familyData?.family_id) {
              // Get all books in user's family catalog
              const { data: ownedBooks, error: ownedError } = await supabase
                .from('family_books')
                .select(`
                  book_catalog_id,
                  book_catalog (
                    title,
                    author,
                    series
                  )
                `)
                .eq('family_id', familyData.family_id);

              if (ownedError) {
                console.log(`[detectBooksFromImage] Owned books lookup warning: ${ownedError.message} - skipping ownership check`);
              } else if (ownedBooks) {
                // Create a set of owned book keys for quick lookup
                const ownedKeys = new Set();
                for (const owned of ownedBooks) {
                  const bookData = owned.book_catalog;
                  if (bookData) {
                    const series = (bookData.series || '').toLowerCase().trim();
                    const key = `${bookData.title.toLowerCase().trim()}|${(bookData.author || '').toLowerCase().trim()}|${series}`;
                    ownedKeys.add(key);
                  }
                }

                // Mark books as already owned
                for (const book of enrichedBooks) {
                  const series = (book.series || '').toLowerCase().trim();
                  const key = `${book.title.toLowerCase().trim()}|${(book.author || '').toLowerCase().trim()}|${series}`;
                  book.alreadyOwned = ownedKeys.has(key);
                }

                console.log(`[detectBooksFromImage] Found ${ownedKeys.size} books in catalog, marked ${enrichedBooks.filter(b => b.alreadyOwned).length} as already owned`);
              }
            }
          } catch (ownershipError) {
            console.error(`[detectBooksFromImage] Ownership check failed: ${ownershipError.message} - continuing without ownership data`);
            // Continue without ownership data - all books will have alreadyOwned: false
          }

          // Update job with results (95-100% complete)
          await onProgress('finalizing', 95, 'Saving results...');
          
          const { error: updateError } = await supabase
            .from('detection_jobs')
            .update({
              status: 'completed',
              progress: 100,
              result: {
                books: enrichedBooks,
                count: enrichedBooks.length
              },
              image_analysis_metadata: detectionResult.metadata,
              stage: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

          if (updateError) {
            console.error(`[detectBooksFromImage] Failed to update job ${job.id}:`, updateError);
          } else {
            console.log(`[detectBooksFromImage] ✓ Local detection completed for job: ${job.id}`);
          }
        } else {
          // No books detected
          console.warn('[detectBooksFromImage] No books detected in image');
          
          await supabase
            .from('detection_jobs')
            .update({
              status: 'completed',
              progress: 100,
              result: {
                books: [],
                count: 0
              },
              image_analysis_metadata: detectionResult.metadata,
              stage: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }

      } catch (error) {
        console.error(`[detectBooksFromImage] ✗ Local detection failed for job ${job.id}:`, error);
        await supabase
          .from('detection_jobs')
          .update({
            status: 'failed',
            error_code: 'UNEXPECTED_ERROR',
            error: error.message,
            can_retry: true,
            stage: 'failed_other',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    })();

    // Return immediately
    console.log('[detectBooksFromImage] ✓ Local detection started, returning jobId to client');
    return res.json({
      jobId: job.id,
      status: 'processing',
      progress: 0,
      message: 'Detection started locally. Poll /api/books/detect-job/:jobId for status.'
    });
  }

  // Trigger Supabase Edge Function (async - don't wait for response)
  const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL;
  
  if (!edgeFunctionUrl) {
    console.error('[detectBooksFromImage] ✗ SUPABASE_EDGE_FUNCTION_URL not configured');
    console.error('[detectBooksFromImage] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    return res.status(503).json({ 
      error: 'Edge function not configured',
      message: 'SUPABASE_EDGE_FUNCTION_URL environment variable is missing'
    });
  }

  console.log(`[detectBooksFromImage] Edge function URL: ${edgeFunctionUrl}`);
  console.log(`[detectBooksFromImage] Image base64 length: ${imageBase64.length} chars`);

  // Call edge function asynchronously (fire and forget)
  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      jobId: job.id,
      imageData: imageBase64
    })
  })
  .then(response => {
    console.log(`[detectBooksFromImage] ✓ Edge function triggered, status: ${response.status}`);
    if (!response.ok) {
      console.error(`[detectBooksFromImage] ✗ Edge function returned error status: ${response.status}`);
      return response.text().then(text => {
        console.error('[detectBooksFromImage] Edge function error response:', text);
      });
    }
  })
  .catch(err => {
    console.error('[detectBooksFromImage] ✗ Failed to trigger edge function:', err.message);
    console.error('[detectBooksFromImage] Error stack:', err.stack);
    // Update job status to failed
    supabase
      .from('detection_jobs')
      .update({ 
        status: 'failed', 
        error: 'Failed to trigger processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .then(() => console.log(`[detectBooksFromImage] Marked job ${job.id} as failed`))
      .catch(e => console.error('[detectBooksFromImage] Failed to update job:', e));
  });

  console.log(`[detectBooksFromImage] ✓ Triggered edge function for job: ${job.id}`);
  console.log(`[detectBooksFromImage] ✓ Returning jobId to client, client should poll /api/books/detect-job/${job.id}`);

  // Return immediately with jobId
  res.json({
    jobId: job.id,
    status: 'processing',
    progress: 0,
    message: 'Detection started. Poll /api/books/detect-job/:jobId for status.'
  });
});

/**
 * Get detection job status
 * @route GET /api/books/detect-job/:jobId
 */
export const getDetectionJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  console.log(`[getDetectionJob] === POLLING REQUEST ===`);
  console.log(`[getDetectionJob] Job ID: ${jobId}`);
  console.log(`[getDetectionJob] User ID: ${req.user?.id}`);

  // Validate user authentication
  if (!req.user || !req.user.id) {
    console.error('[getDetectionJob] ✗ User not authenticated');
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const { supabase } = await import('../db/adapter.js');
  const { 
    data: job, 
    error 
  } = await supabase
    .from('detection_jobs')
    .select(`
      id, 
      status, 
      progress, 
      stage,
      result, 
      error_code,
      error,
      can_retry,
      created_at, 
      updated_at,
      image_original_filename,
      image_mime_type,
      image_size_bytes,
      image_base64_thumbnail,
      image_uploaded_at,
      image_storage_path,
      image_storage_url,
      image_storage_expires_at,
      image_analysis_metadata
    `)
    .eq('id', jobId)
    .eq('user_id', req.user.id)
    .single();

  if (error || !job) {
    console.error('[getDetectionJob] ✗ Job not found or access denied:', error?.message);
    return res.status(404).json({ error: 'Job not found' });
  }

  console.log(`[getDetectionJob] Job status: ${job.status}, progress: ${job.progress}%, stage: ${job.stage}`);
  
  // If image storage URL is expired (or missing), try to refresh it
  let imageUrl = job.image_storage_url;
  if (job.image_storage_path && (!job.image_storage_expires_at || new Date(job.image_storage_expires_at) <= new Date())) {
    try {
      console.log(`[getDetectionJob] Refreshing expired image URL for job ${jobId}`);
      const { refreshSignedUrl } = await import('../services/storageService.js');
      const refreshed = await refreshSignedUrl(supabase, job.image_storage_path);
      if (refreshed?.url) {
        imageUrl = refreshed.url;
        // Update the job with new URL and expiry
        await supabase
          .from('detection_jobs')
          .update({
            image_storage_url: refreshed.url,
            image_storage_expires_at: refreshed.expiresAt
          })
          .eq('id', jobId);
      }
    } catch (refreshErr) {
      console.error(`[getDetectionJob] Failed to refresh image URL: ${refreshErr.message}`);
      // Continue with expired URL - client can request refresh
    }
  }
  
  // Build response with image information
  const response = {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    result: job.result,
    error: job.error,
    error_code: job.error_code,
    can_retry: job.can_retry,
    created_at: job.created_at,
    updated_at: job.updated_at,
    image: {
      filename: job.image_original_filename,
      mime_type: job.image_mime_type,
      size_bytes: job.image_size_bytes,
      thumbnail: job.image_base64_thumbnail, // Base64 thumbnail for quick display
      uploaded_at: job.image_uploaded_at,
      url: imageUrl, // Signed URL for full resolution image
      expires_at: job.image_storage_expires_at,
      storage_path: job.image_storage_path
    },
    analysis: job.image_analysis_metadata // Metadata from detection process
  };
  
  if (job.status === 'completed' && job.result) {
    const bookCount = job.result?.books?.length || 0;
    console.log(`[getDetectionJob] ✓ Job completed with ${bookCount} books detected`);
  } else if (job.status === 'failed') {
    console.error(`[getDetectionJob] ✗ Job failed with code ${job.error_code}: ${job.error}`);
  } else {
    console.log(`[getDetectionJob] Job still processing... Stage: ${job.stage}`);
  }

  res.json(response);
});

// OLD SYNCHRONOUS CODE BELOW - KEPT FOR REFERENCE/FALLBACK
// This can be removed once async is fully tested
/*
const detectBooksSynchronous = async (req, res) => {
  // Detect books using AI
  const detectedBooks = await aiVisionService.detectBooksFromImage(req.file.buffer);

  console.log(`Successfully detected ${detectedBooks.length} books, starting online search...`);

  // Search for book details in parallel
  const bookSearchPromises = detectedBooks.map(async (book) => {
    try {
      const bookDetails = await searchBookDetails(book.title, book.author);

      if (bookDetails && bookDetails.confidence >= 70) {
        // High confidence - merge all details, prefer bookDetails but keep AI's genre/age_range if available
        return {
          ...book,
          ...bookDetails,
          // Preserve genre and age_range from AI if bookDetails doesn't have them
          genre: bookDetails.genre || book.genre || null,
          age_range: bookDetails.age_range || book.age_range || null,
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
          genre: book.genre || bookDetails.genre || null,
          age_range: book.age_range || bookDetails.age_range || null,
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

  // Deduplicate books based on title, author, series, and series_number (case-insensitive)
  const uniqueBooks = [];
  const seen = new Set();
  
  for (const book of enrichedBooks) {
    // Include series and series_number in the key to allow multiple books from same series
    const series = (book.series || '').toLowerCase().trim();
    const seriesNum = book.series_number != null ? String(book.series_number) : '';
    const key = `${book.title.toLowerCase().trim()}|${(book.author || '').toLowerCase().trim()}|${series}|${seriesNum}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBooks.push(book);
    } else {
      console.log(`Skipping duplicate detected book: "${book.title}" by ${book.author}${series ? ` (${series} #${seriesNum})` : ''}`);
    }
  }

  console.log(`Detected ${enrichedBooks.length} books, ${uniqueBooks.length} unique after deduplication`);

  // Sort by confidence (high first, then medium, then low)
  const sortedBooks = uniqueBooks.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const orderDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (orderDiff !== 0) return orderDiff;
    // Within same confidence level, sort by confidence score
    return b.confidenceScore - a.confidenceScore;
  });

  console.log(`High confidence: ${sortedBooks.filter(b => b.confidence === 'high').length}`);
  console.log(`Medium confidence: ${sortedBooks.filter(b => b.confidence === 'medium').length}`);
  console.log(`Low confidence: ${sortedBooks.filter(b => b.confidence === 'low').length}`);

  res.json({
    success: true,
    books: sortedBooks,
    count: sortedBooks.length
  });
};
*/

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
          reason: 'already_owned',
          message: 'הספר כבר קיים בספרייה שלך'
        });
      } else {
        addedBooks.push(data);
      }
    } else {
      console.error('Book processing error:', result.reason);
      
      // Parse error message for better user feedback
      let errorMessage = result.reason?.message || 'Unknown error';
      
      // Check for duplicate constraint error
      if (errorMessage.includes('duplicate key value violates unique constraint')) {
        if (errorMessage.includes('family_books_family_id_book_catalog_id_key')) {
          errorMessage = 'הספר כבר קיים בספרייה שלך';
          // This is actually a skip, not an error
          skippedBooks.push({
            title: originalBook.title,
            author: originalBook.author || 'לא ידוע',
            reason: 'already_owned',
            message: errorMessage
          });
          continue; // Don't add to errors
        } else if (errorMessage.includes('books_catalog_title_author_key')) {
          errorMessage = 'הספר כבר קיים בקטלוג המשותף';
        }
      } else if (errorMessage.includes('violates foreign key constraint')) {
        errorMessage = 'שגיאת מסד נתונים - משפחה לא נמצאה';
      } else if (errorMessage.includes('violates not-null constraint')) {
        errorMessage = 'חסרים שדות חובה (כותרת)';
      }
      
      errors.push({
        book: originalBook,
        error: errorMessage
      });
    }
  }

  console.log(`[bulkAddBooks] Summary: ${addedBooks.length} added, ${skippedBooks.length} skipped, ${errors.length} failed`);

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
