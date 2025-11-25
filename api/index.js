// Vercel serverless function entry point
import express from 'express';
import cors from 'cors';
import { db, supabase } from './db/adapter.js';

const app = express();

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
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    const books = await db.books.search(q);
    res.json({ books });
  } catch (error) {
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

export default app;
