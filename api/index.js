// Vercel serverless function entry point
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db, supabase, supabaseAuth } from './db/adapter.js';
import GeminiVisionService from './services/geminiVision.js';
import OpenAIVisionService from './services/openaiVision.js';
import HybridVisionService from './services/hybridVision.js';
import { searchBookDetails, searchBooks } from './services/bookSearch.js';

const app = express();

// Environment detection
const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
const dbUrl = process.env.SUPABASE_URL || process.env.POSTGRES_URL || '';
const dbIdentifier = dbUrl.includes('supabase.co') 
  ? dbUrl.split('//')[1]?.split('.')[0] || 'unknown'
  : 'unknown';

console.log('='.repeat(60));
console.log(`🚀 API starting in ${environment.toUpperCase()} environment`);
console.log(`📊 Database: ${dbIdentifier}`);
console.log('='.repeat(60));

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
      // Pass error as null to avoid HTML error page, check in route handler
      cb(null, false);
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to extract user ID from JWT token
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Verify token with Supabase
      const { data: { user }, error } = await authClient.auth.getUser(token);
      if (user && !error) {
        let resolvedUserId = user.id;
        let resolvedFamilyId = null;

        try {
          // Prefer direct match on primary key (id)
          let { data: userRecord, error: userRecordError } = await supabase
            .from('users')
            .select('id, family_id')
            .eq('id', user.id)
            .single();

          if (userRecordError || !userRecord) {
            // Legacy fallback for schemas that used auth_id column
            const { data: legacyRecord } = await supabase
              .from('users')
              .select('id, family_id')
              .eq('auth_id', user.id)
              .single();
            userRecord = legacyRecord || null;
          }

          if (userRecord) {
            resolvedUserId = userRecord.id;
            resolvedFamilyId = userRecord.family_id || null;
          }
        } catch (lookupError) {
          console.warn('User context lookup failed:', lookupError.message);
        }

        req.headers['x-user-id'] = resolvedUserId;
        if (resolvedFamilyId) {
          req.headers['x-family-id'] = resolvedFamilyId;
        }
      }
    } catch (err) {
      // Silently fail - endpoints will handle missing user ID
      console.error('Token verification error:', err.message);
    }
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Community Library API is running',
    environment: environment,
    database: dbIdentifier,
    timestamp: new Date().toISOString(),
    env_check: {
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_anon_key: !!process.env.SUPABASE_ANON_KEY,
      has_url: !!process.env.SUPABASE_URL,
      service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'MISSING'
    }
  });
});

// Book search endpoint
app.get('/api/search-books', async (req, res) => {
  try {
    const { q, query, provider = 'auto', maxResults = 10, userId } = req.query;
    
    // Support both 'q' and 'query' parameters
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({ 
        error: 'Missing query parameter',
        message: 'Please provide a search query using ?q=... or ?query=...'
      });
    }
    
    console.log(`Book search request: "${searchQuery}" (provider: ${provider})`);
    
    // First, search our own catalog
    const { data: catalogResults, error: catalogError } = await supabase
      .from('book_catalog')
      .select('*')
      .or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`)
      .limit(10);
    
    if (catalogError) {
      console.error('Catalog search error:', catalogError);
    }
    
    // If user ID provided, check which books they already own
    let userOwnedBookIds = new Set();
    if (userId && catalogResults?.length > 0) {
      const { data: userBooks, error: userBooksError } = await supabase
        .from('family_books')
        .select('book_catalog_id, families!inner(users!inner(id))')
        .eq('families.users.id', userId);
      
      if (!userBooksError && userBooks) {
        userOwnedBookIds = new Set(userBooks.map(b => b.book_catalog_id));
      }
    }
    
    // Transform catalog results to match external API format
    const catalogBooks = (catalogResults || []).map(book => ({
      title: book.title,
      author: book.author,
      series: book.series,
      series_number: book.series_number,
      publisher: book.publisher,
      publish_year: book.year_published,
      pages: book.pages,
      description: book.summary,
      cover_image_url: book.cover_image_url,
      isbn: book.isbn,
      genre: book.genre,
      language: 'he',
      source: 'catalog',
      catalogId: book.id,
      alreadyOwned: userOwnedBookIds.has(book.id),
      confidence: 'exact',
      confidenceScore: 100
    }));
    
    // Search external sources
    const externalResults = await searchBooks(searchQuery, { 
      provider, 
      maxResults: parseInt(maxResults) 
    });
    
    // Combine results: catalog first, then external
    const allResults = [...catalogBooks, ...externalResults];
    
    res.json({
      success: true,
      query: searchQuery,
      provider,
      count: allResults.length,
      catalogCount: catalogBooks.length,
      externalCount: externalResults.length,
      results: allResults
    });
    
  } catch (error) {
    console.error('Book search endpoint error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message 
    });
  }
});

// ==================== AUTH ROUTES ====================

const authClient = supabaseAuth ?? supabase;

if (!supabaseAuth) {
  console.warn('supabaseAuth client not configured. Falling back to service client for auth operations.');
}

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, whatsapp, familyName, familyPhone, familyWhatsapp, existingFamilyId } = req.body;

    console.log('Registration attempt:', { email, fullName, familyName, existingFamilyId });

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields: email, password, fullName' });
    }

    // Create unique auth email by appending UUID to handle shared emails
    // The actual email is stored in the users table
    // Use dot notation for better email validation compatibility
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8); // Letters only, no numbers at start
    const uniqueAuthEmail = `${email.split('@')[0]}.${randomStr}.${timestamp}@${email.split('@')[1]}`;

    // Create auth user with unique email
    const { data: authData, error: authError } = await authClient.auth.signUp({
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
      console.log('Joining existing family:', familyId);
    } else if (familyName) {
      // Create new family - use direct supabase call with service role to bypass RLS
      console.log('Creating new family:', { familyName, phone: familyPhone || phone });
      console.log('Environment check:');
      console.log('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : 'MISSING');
      console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL || 'MISSING');
      console.log('  - supabase client headers:', supabase.rest?.headers || 'N/A');
      
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert({
          name: familyName,
          phone: familyPhone || phone,
          whatsapp: familyWhatsapp || whatsapp || phone,
          email
        })
        .select()
        .single();
      
      if (familyError) {
        console.error('Family creation error:', familyError);
        console.error('Error code:', familyError.code);
        console.error('Error message:', familyError.message);
        console.error('Error details:', familyError.details);
        console.error('Full error object:', JSON.stringify(familyError, null, 2));
        
        // Clean up the auth user if family creation fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
          console.log('Auth user cleaned up after family creation failure');
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError.message);
        }
        
        return res.status(400).json({ error: 'Failed to create family: ' + familyError.message });
      }
      
      console.log('Family created successfully:', newFamily.id);
      familyId = newFamily.id;
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

    const { data, error } = await authClient.auth.signInWithPassword({
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
    const { error } = await authClient.auth.signOut();
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
    const { data: { user }, error } = await authClient.auth.getUser(token);

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

// Check for families with the same name
app.post('/api/families/check-name', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Family name is required' });
    }

    // Find families with matching name using db adapter
    const allFamilies = await db.families.getAll();
    const matchingFamilies = allFamilies.filter(f => 
      f.name.toLowerCase() === name.toLowerCase()
    );

    // Get members for each matching family
    const familiesWithMembers = await Promise.all(
      matchingFamilies.map(async (family) => {
        try {
          const members = await db.families.getMembers(family.id);
          return {
            ...family,
            members: members.map(m => ({ id: m.id, full_name: m.full_name }))
          };
        } catch (err) {
          console.error('Error getting members for family:', family.id, err);
          return {
            ...family,
            members: []
          };
        }
      })
    );

    res.json({ 
      exists: familiesWithMembers.length > 0,
      families: familiesWithMembers 
    });
  } catch (error) {
    console.error('Check family name error:', error);
    res.status(500).json({ error: error.message || 'Failed to check family name' });
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
    const { familyId, noFamily } = req.query;
    const users = familyId 
      ? await db.users.getAll({ familyId })
      : noFamily
      ? await db.users.getAll({ noFamily: true })
      : await db.users.getAll();
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

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.users.delete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== BOOKS ROUTES ====================

const formatFamilyContact = (family) => {
  if (!family) return null;
  return {
    id: family.id,
    name: family.name,
    phone: family.phone || null,
    whatsapp: family.whatsapp || null,
    email: family.email || null,
  };
};

const normalizeLoanRecord = (loan) => {
  if (!loan) return null;
  return {
    id: loan.id,
    status: loan.status,
    familyBookId: loan.family_book_id,
    borrowerFamilyId: loan.borrower_family_id,
    ownerFamilyId: loan.owner_family_id,
    requestDate: loan.request_date,
    approvedDate: loan.approved_date,
    dueDate: loan.due_date,
    returnDate: loan.actual_return_date || loan.return_date || null,
    notes: loan.notes || null,
    borrowerFamily: formatFamilyContact(loan.borrower_family),
    ownerFamily: formatFamilyContact(loan.owner_family),
  };
};

const groupBooksForResponse = ({ books, loanMap, likesMap, viewerFamilyId, view, sortBy }) => {
  const grouped = new Map();

  for (const book of books) {
    const catalogId = book.book_catalog_id || book.book_catalog?.id;
    if (!catalogId) continue;

    if (!grouped.has(catalogId)) {
      grouped.set(catalogId, {
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
        stats: {
          totalCopies: 0,
          availableCopies: 0,
          onLoanCopies: 0,
        },
        likesCount: likesMap.get(catalogId) || 0,
        owners: [],
        viewerContext: {
          owns: false,
          borrowed: false,
          ownedCopies: [],
          borrowedLoan: null,
        },
        updatedAt: book.updated_at,
      });
    }

    const group = grouped.get(catalogId);
    const loan = loanMap.get(book.id) || null;
    const isViewerOwner = Boolean(viewerFamilyId && book.family_id === viewerFamilyId);

    const ownerEntry = {
      familyBookId: book.id,
      status: book.status,
      condition: book.condition,
      notes: book.notes,
      familyId: book.family_id,
      family: formatFamilyContact(book.families),
      loan,
      isViewerOwner,
    };

    group.owners.push(ownerEntry);
    group.stats.totalCopies += 1;
    if (book.status === 'available') {
      group.stats.availableCopies += 1;
    }
    if (loan) {
      group.stats.onLoanCopies += 1;
    }

    if (isViewerOwner) {
      group.viewerContext.owns = true;
      group.viewerContext.ownedCopies.push({
        familyBookId: book.id,
        status: book.status,
        loan,
      });
    }

    if (loan && viewerFamilyId && loan.borrowerFamilyId === viewerFamilyId) {
      group.viewerContext.borrowed = true;
      group.viewerContext.borrowedLoan = loan;
    }
  }

  let response = Array.from(grouped.values());

  if (view === 'my') {
    response = response.filter((book) => book.viewerContext.owns);
  } else if (view === 'borrowed') {
    response = response.filter((book) => book.viewerContext.borrowed);
  }

  response.sort((a, b) => {
    switch (sortBy) {
      case 'author':
        return (a.author || '').localeCompare(b.author || '', 'he');
      case 'updated':
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      case 'title':
      default:
        return (a.title || '').localeCompare(b.title || '', 'he');
    }
  });

  return response;
};

const parseNumberParam = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

app.get('/api/books', async (req, res) => {
  try {
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

    const userId = req.headers['x-user-id'];
    const familyIdHeader = req.headers['x-family-id'];
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
      return res.status(400).json({ error: 'Family context required for this view' });
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

      const borrowedIds = borrowedLoans
        .map((loan) => loan.family_book_id)
        .filter(Boolean);

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

    const missingLoanIds = books
      .map((book) => book.id)
      .filter((id) => id && !loanMap.has(id));

    if (missingLoanIds.length) {
      const activeLoans = await db.loans.getAll({ bookIds: missingLoanIds, status: 'active' });
      activeLoans.forEach((loan) => {
        if (loan.family_book_id) {
          loanMap.set(loan.family_book_id, normalizeLoanRecord(loan));
        }
      });
    }

    // Fetch likes count for all catalog IDs in one query
    const catalogIds = [...new Set(books.map(b => b.book_catalog_id).filter(Boolean))];
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
  } catch (error) {
    console.error('Error fetching books:', error);
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
    console.log('Creating loan with payload:', req.body);
    
    // Convert book_id to family_book_id if needed
    if (req.body.book_id && !req.body.family_book_id) {
      req.body.family_book_id = req.body.book_id
    }
    
    // Always create loans with active status
    req.body.status = 'active'
    
    const loan = await db.loans.create(req.body);
    console.log('Loan created:', loan);
    
    // Update book status to on_loan
    const bookId = req.body.family_book_id || req.body.book_id
    console.log('Updating book status for:', bookId);
    await db.books.update(bookId, { status: 'on_loan' });
    console.log('Book status updated');
    
    res.status(201).json({ loan });
  } catch (error) {
    console.error('Error creating loan:', error);
    console.error('Error details:', error.message, error.code, error.details);
    res.status(500).json({ error: error.message || 'Failed to create loan' });
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
    // Get user_id from header (preferred) or body (for backwards compatibility)
    const userId = req.headers['x-user-id'] || req.body.user_id;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const review = await db.reviews.create({
      book_id: req.params.bookId,
      user_id: userId,
      rating: req.body.rating,
      review_text: req.body.review_text
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

// ==================== RECOMMENDATIONS ROUTES ====================

app.get('/api/recommendations', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get user's liked books with catalog info
    const { data: likesData, error: likesError } = await supabase
      .from('likes')
      .select('book_catalog_id')
      .eq('user_id', userId);

    if (likesError) throw likesError;

    // Get catalog info for liked books
    const likedCatalogIds = (likesData || []).map(l => l.book_catalog_id).filter(Boolean);
    let likedBooks = [];
    if (likedCatalogIds.length > 0) {
      const { data: catalogData } = await supabase
        .from('book_catalog')
        .select('id, genre, age_level, author')
        .in('id', likedCatalogIds);
      likedBooks = catalogData || [];
    }

    // Get user's high-rated reviews with catalog info
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('book_catalog_id, rating')
      .eq('user_id', userId)
      .gte('rating', 4);

    if (reviewsError) throw reviewsError;

    // Get catalog info for reviewed books
    const reviewedCatalogIds = (reviewsData || []).map(r => r.book_catalog_id).filter(Boolean);
    let highRatedBooks = [];
    if (reviewedCatalogIds.length > 0) {
      const { data: catalogData } = await supabase
        .from('book_catalog')
        .select('id, genre, age_level, author')
        .in('id', reviewedCatalogIds);
      highRatedBooks = catalogData || [];
    }

    // Extract preferred genres and age levels
    const preferredGenres = new Map();
    const preferredAgeLevels = new Map();

    [...likedBooks, ...highRatedBooks].forEach(book => {
      if (!book) return;
      
      if (book.genre) {
        preferredGenres.set(book.genre, (preferredGenres.get(book.genre) || 0) + 1);
      }
      if (book.age_level) {
        preferredAgeLevels.set(book.age_level, (preferredAgeLevels.get(book.age_level) || 0) + 1);
      }
    });

    // Get user's family books (to exclude)
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', userId)
      .single();

    const familyId = userData?.family_id;

    // Get all book catalog IDs user has interacted with (to exclude from recommendations)
    const interactedBookCatalogIds = new Set([
      ...likedCatalogIds,
      ...reviewedCatalogIds
    ]);

    // Build recommendation query
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
      .neq('family_id', familyId);

    // If we have preferred genres, filter by them
    if (preferredGenres.size > 0) {
      const topGenres = Array.from(preferredGenres.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);
      
      query = query.in('genre', topGenres);
    }

    const { data: recommendations, error: recsError } = await query.limit(20);

    if (recsError) throw recsError;

    // Filter out books user has already interacted with (by catalog ID)
    let filteredRecs = (recommendations || []).filter(
      book => !interactedBookCatalogIds.has(book.book_catalog_id)
    );

    // Calculate match scores and reasons
    const scoredRecs = filteredRecs.map(book => {
      let score = 0;
      let reasons = [];

      // Genre match (0-40 points)
      if (book.genre && preferredGenres.has(book.genre)) {
        score += 40;
        reasons.push(`אהבת ספרי ${book.genre}`);
      }

      // Age level match (0-20 points)
      if (book.age_range && preferredAgeLevels.has(book.age_range)) {
        score += 20;
      }

      // Same author as liked books (0-20 points)
      const likedAuthors = [...likedBooks, ...highRatedBooks]
        .map(book => book?.author)
        .filter(Boolean);
      
      if (likedAuthors.includes(book.author)) {
        score += 20;
        reasons.push(`אהבת ספרים של ${book.author}`);
      }

      // Random factor (0-20 points) for diversity
      score += Math.random() * 20;

      return {
        ...book,
        match_percentage: Math.min(100, Math.round(score)),
        reason: reasons[0] || 'מתאים לטעם שלך'
      };
    });

    // Sort by score and take top 12
    const topRecs = scoredRecs
      .sort((a, b) => b.match_percentage - a.match_percentage)
      .slice(0, 12);

    res.json({ recommendations: topRecs });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GENRE MAPPING ROUTES ====================

const isMissingGenreTableError = (error) => {
  return Boolean(error?.message && error.message.includes('genre_mappings') && error.message.includes('schema cache'));
};

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
    if (isMissingGenreTableError(error)) {
      console.warn('genre_mappings table missing - returning empty mapping list');
      return res.json({ mappings: [] });
    }
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
    if (isMissingGenreTableError(error)) {
      console.warn('genre_mappings table missing - genre mapping persistence disabled');
      return res.status(501).json({
        error: 'Genre mappings storage is not configured yet',
        message: 'Create the genre_mappings table to enable this feature',
      });
    }
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
    
    // Validate input first (before auth check)
    if (!books) {
      return res.status(400).json({ error: 'No books provided' });
    }
    
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: 'No books provided' });
    }
    
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

    if (books.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 books per batch' });
    }

    // Validate and add each book
    const addedBooks = [];
    const skippedBooks = [];
    const errors = [];
    
    for (const book of books) {
      try {
        // Basic validation
        if (!book.title || typeof book.title !== 'string') {
          errors.push({ book, error: 'Missing or invalid title' });
          continue;
        }

        // Prepare book data
        // Validate ISBN: convert 0, '0', or empty string to null
        let cleanIsbn = book.isbn
        if (!cleanIsbn || cleanIsbn === 0 || cleanIsbn === '0' || cleanIsbn === '') {
          cleanIsbn = null
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
        
      } catch (error) {
        console.error('Book processing error:', error);
        errors.push({ book, error: error.message });
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
    
  } catch (error) {
    console.error('Bulk add error:', error);
    res.status(500).json({ error: 'Failed to add books', message: error.message });
  }
});

export default app;
