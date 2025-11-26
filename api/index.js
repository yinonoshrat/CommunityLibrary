// Vercel serverless function entry point
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db, supabase } from './db/adapter.js';
import GeminiVisionService from './services/geminiVision.js';
import OpenAIVisionService from './services/openaiVision.js';
import HybridVisionService from './services/hybridVision.js';
import { searchBookDetails } from './services/bookSearch.js';

const app = express();

// Initialize AI Vision Service (priority order: Hybrid > OpenAI > Gemini)
let aiVisionService = null;
let serviceName = 'none';
try {
  // Hybrid (Google Cloud Vision OCR + Gemini) - Best accuracy
  if ((process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS) && process.env.GEMINI_API_KEY) {
    aiVisionService = new HybridVisionService();
    serviceName = 'Hybrid (Google Cloud OCR + Gemini)';
  }
  // OpenAI GPT-4o-mini - Fast and accurate
  else if (process.env.OPENAI_API_KEY) {
    aiVisionService = new OpenAIVisionService();
    serviceName = 'OpenAI (GPT-4o-mini)';
  }
  // Gemini only - Fallback
  else if (process.env.GEMINI_API_KEY) {
    aiVisionService = new GeminiVisionService();
    serviceName = 'Gemini (2.5 Flash)';
  }
  
  if (aiVisionService) {
    console.log(`✓ AI Vision Service initialized: ${serviceName}`);
  } else {
    console.warn('⚠ No AI API keys found - bulk upload features will be disabled');
    console.warn('  Set one of: OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS');
  }
} catch (error) {
  console.error('✗ Failed to initialize AI Vision Service:', error.message);
  console.error('  Service attempted:', serviceName);
}

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Community Library API is running' });
});

// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, whatsapp, familyName, familyPhone, familyWhatsapp, existingFamilyId } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields: email, password, fullName' });
    }

    // Create unique auth email by appending UUID to handle shared emails
    // The actual email is stored in the users table
    const uniqueAuthEmail = `${email.split('@')[0]}+${Date.now()}-${Math.random().toString(36).substring(7)}@${email.split('@')[1]}`;

    // Create auth user with unique email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: uniqueAuthEmail,
      password,
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    // Determine family ID
    let familyId = null;
    
    if (existingFamilyId) {
      // Join existing family
      familyId = existingFamilyId;
    } else if (familyName) {
      // Create new family
      const family = await db.families.create({
        name: familyName,
        phone: familyPhone || phone,
        whatsapp: familyWhatsapp || whatsapp || phone,
        email
      });
      familyId = family.id;
    }

    // Create user profile with actual email and auth_email
    const user = await db.users.create({
      id: authData.user.id,
      email, // Store the actual shared email
      auth_email: uniqueAuthEmail, // Store the unique auth email
      full_name: fullName,
      phone,
      whatsapp: whatsapp || phone,
      family_id: familyId,
      is_family_admin: existingFamilyId ? false : (familyId ? true : false)
    });

    res.status(201).json({ user, family_id: familyId });
  } catch (error) {
    console.error('Registration error:', error);
    // Ensure we always return valid JSON
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// Get users by email (for login with shared emails)
app.post('/api/auth/accounts-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get all users with this email
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, families(id, name)')
      .eq('email', email)
      .order('full_name');

    if (error) throw error;

    res.json({ accounts: users || [] });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, userId, rememberMe } = req.body;

    // If userId is provided, get the auth_email for that specific user
    let authEmail = email;
    if (userId) {
      // Get the auth_email for this user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('auth_email, email')
        .eq('id', userId)
        .single();
      
      if (userError || !userData) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      // Use auth_email if it exists, otherwise fall back to regular email
      authEmail = userData.auth_email || userData.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) throw error;

    // Update remember_me preference
    if (rememberMe !== undefined) {
      await db.users.update(data.user.id, { remember_me: rememberMe });
    }

    // Get full user profile
    const user = await db.users.getById(data.user.id);

    res.json({ session: data.session, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) throw error;

    const userProfile = await db.users.getById(user.id);
    res.json({ user: userProfile });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// ==================== FAMILIES ROUTES ====================

app.get('/api/families', async (req, res) => {
  try {
    const families = await db.families.getAll();
    
    // Get members for each family to help identify families with same names
    const familiesWithMembers = await Promise.all(
      families.map(async (family) => {
        const members = await db.families.getMembers(family.id);
        return {
          ...family,
          members: members.map(m => ({ id: m.id, full_name: m.full_name }))
        };
      })
    );
    
    res.json({ families: familiesWithMembers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/families/:id', async (req, res) => {
  try {
    const family = await db.families.getById(req.params.id);
    res.json({ family });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/families', async (req, res) => {
  try {
    const family = await db.families.create(req.body);
    res.status(201).json({ family });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/families/:id', async (req, res) => {
  try {
    const family = await db.families.update(req.params.id, req.body);
    res.json({ family });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/families/:id', async (req, res) => {
  try {
    await db.families.delete(req.params.id);
    res.json({ message: 'Family deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/families/:id/members', async (req, res) => {
  try {
    const members = await db.families.getMembers(req.params.id);
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USERS ROUTES ====================

app.get('/api/users', async (req, res) => {
  try {
    const users = await db.users.getAll();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.users.getById(req.params.id);
    res.json({ user });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await db.users.update(req.params.id, req.body);
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== BOOKS ROUTES ====================

app.get('/api/books', async (req, res) => {
  try {
    const { familyId, status, title, author, genre, series } = req.query;
    const books = await db.books.getAll({
      familyId,
      status,
      title,
      author,
      genre,
      series
    });
    res.json({ books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/books/search', async (req, res) => {
  try {
    const { q, genre, ageLevel, available } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Search across all books in the community
    let query = supabase
      .from('books_view')
      .select(`
        *,
        families:family_id (
          id,
          name,
          phone,
          whatsapp
        )
      `)
      .or(`title.ilike.%${q}%,author.ilike.%${q}%,series.ilike.%${q}%`);

    // Apply filters
    if (genre && genre !== 'all') {
      query = query.eq('genre', genre);
    }
    
    if (ageLevel && ageLevel !== 'all') {
      query = query.eq('age_level', ageLevel);
    }
    
    if (available === 'true') {
      query = query.eq('status', 'available');
    }

    const { data: books, error } = await query.order('title');

    if (error) throw error;

    // Group books by title to show all families that have each book
    const booksByTitle = {};
    for (const book of (books || [])) {
      const key = `${book.title}-${book.author}`;
      if (!booksByTitle[key]) {
        booksByTitle[key] = {
          ...book,
          families: [book.families],
          availableCount: book.status === 'available' ? 1 : 0,
          totalCount: 1
        };
      } else {
        booksByTitle[key].families.push(book.families);
        booksByTitle[key].totalCount++;
        if (book.status === 'available') {
          booksByTitle[key].availableCount++;
        }
      }
    }

    const results = Object.values(booksByTitle);
    res.json({ books: results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await db.books.getById(req.params.id);
    res.json({ book });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get all families that have a specific book (by title/author)
app.get('/api/books/:id/families', async (req, res) => {
  try {
    // First get the family_book to get its book_catalog_id
    const { data: familyBook, error: fbError } = await supabase
      .from('family_books')
      .select('book_catalog_id')
      .eq('id', req.params.id)
      .single();

    if (fbError) throw fbError;

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
      .select(`
        id,
        status,
        notes,
        families:family_id (
          id,
          name,
          phone,
          whatsapp
        )
      `)
      .eq('book_catalog_id', catalogId);

    if (error) throw error;

    // Check loan status for each
    const results = await Promise.all(familyBooks.map(async (fb) => {
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
        currentLoan: loans || null
      };
    }));

    res.json({ book, families: results });
  } catch (error) {
    console.error('Error fetching book families:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const book = await db.books.create(req.body);
    res.status(201).json({ book });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const book = await db.books.update(req.params.id, req.body);
    res.json({ book });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    await db.books.delete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== LOANS ROUTES ====================

app.get('/api/loans', async (req, res) => {
  try {
    const { borrowerFamilyId, ownerFamilyId, status, bookId } = req.query;
    const loans = await db.loans.getAll({
      borrowerFamilyId,
      ownerFamilyId,
      status,
      bookId
    });
    res.json({ loans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/loans/:id', async (req, res) => {
  try {
    const loan = await db.loans.getById(req.params.id);
    res.json({ loan });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    // Convert book_id to family_book_id if needed
    if (req.body.book_id && !req.body.family_book_id) {
      req.body.family_book_id = req.body.book_id
    }
    
    const loan = await db.loans.create(req.body);
    
    // Update book status to on_loan (new status name)
    if (req.body.status === 'active') {
      const bookId = req.body.family_book_id || req.body.book_id
      await db.books.update(bookId, { status: 'on_loan' });
    }
    
    res.status(201).json({ loan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/loans/:id', async (req, res) => {
  try {
    const loan = await db.loans.update(req.params.id, req.body);
    
    // Update book status based on loan status
    if (req.body.status === 'active') {
      await db.books.update(loan.family_book_id, { status: 'on_loan' });
    } else if (req.body.status === 'returned') {
      await db.books.update(loan.family_book_id, { status: 'available' });
    }
    
    res.json({ loan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== REVIEWS ROUTES ====================

app.get('/api/books/:bookId/reviews', async (req, res) => {
  try {
    const reviews = await db.reviews.getByBookId(req.params.bookId);
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/books/:bookId/reviews', async (req, res) => {
  try {
    const review = await db.reviews.create({
      book_id: req.params.bookId,
      ...req.body
    });
    res.status(201).json({ review });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/reviews/:id', async (req, res) => {
  try {
    const review = await db.reviews.update(req.params.id, req.body);
    res.json({ review });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    await db.reviews.delete(req.params.id);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== LIKES ROUTES ====================

app.get('/api/books/:bookId/likes', async (req, res) => {
  try {
    const likes = await db.likes.getByBookId(req.params.bookId);
    res.json({ likes, count: likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/books/:bookId/likes', async (req, res) => {
  try {
    const { user_id } = req.body;
    const result = await db.likes.toggle(req.params.bookId, user_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== GENRE MAPPING ROUTES ====================

// Get all genre mappings
app.get('/api/genre-mappings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('genre_mappings')
      .select('*')
      .order('usage_count', { ascending: false });
    
    if (error) throw error;
    
    res.json({ mappings: data || [] });
  } catch (error) {
    console.error('Failed to fetch genre mappings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save or update a genre mapping
app.post('/api/genre-mappings', async (req, res) => {
  try {
    const { original_category, mapped_genre } = req.body;
    
    if (!original_category || !mapped_genre) {
      return res.status(400).json({ error: 'Missing required fields: original_category, mapped_genre' });
    }
    
    // Try to increment usage count if mapping exists
    const { data: existing, error: fetchError } = await supabase
      .from('genre_mappings')
      .select('*')
      .eq('original_category', original_category)
      .eq('mapped_genre', mapped_genre)
      .single();
    
    if (existing) {
      // Update existing mapping
      const { data, error } = await supabase
        .from('genre_mappings')
        .update({ 
          usage_count: existing.usage_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      res.json({ mapping: data });
    } else {
      // Create new mapping
      const { data, error } = await supabase
        .from('genre_mappings')
        .insert({
          original_category,
          mapped_genre,
          usage_count: 1
        })
        .select()
        .single();
      
      if (error) throw error;
      res.json({ mapping: data });
    }
  } catch (error) {
    console.error('Failed to save genre mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BULK UPLOAD ROUTES ====================

// Detect books from uploaded image using AI
app.post('/api/books/detect-from-image', upload.single('image'), async (req, res) => {
  try {
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
  } catch (error) {
    console.error('=== IMAGE DETECTION ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to detect books from image',
      message: error.message
    });
  }
});

// Bulk add books to catalog
app.post('/api/books/bulk-add', async (req, res) => {
  try {
    const { books } = req.body;
    const userId = req.headers['x-user-id']; // From auth context

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

    // Validate input
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: 'No books provided' });
    }

    if (books.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 books per batch' });
    }

    // Validate and add each book
    const addedBooks = [];
    const errors = [];
    
    for (const book of books) {
      try {
        // Basic validation
        if (!book.title || typeof book.title !== 'string') {
          errors.push({ book, error: 'Missing or invalid title' });
          continue;
        }

        // Prepare book data
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
          isbn: book.isbn || null,
          series: book.series || null
        };

        // Insert book into database
        const { data, error } = await supabase
          .from('books')
          .insert(bookData)
          .select()
          .single();

        if (error) {
          console.error('Failed to insert book:', error);
          errors.push({ book, error: error.message });
          continue;
        }

        addedBooks.push(data);
        
      } catch (error) {
        console.error('Book processing error:', error);
        errors.push({ book, error: error.message });
      }
    }

    res.json({
      success: true,
      added: addedBooks.length,
      failed: errors.length,
      books: addedBooks,
      errors: errors
    });
    
  } catch (error) {
    console.error('Bulk add error:', error);
    res.status(500).json({ error: 'Failed to add books', message: error.message });
  }
});

export default app;
