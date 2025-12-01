import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Present' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Present' : 'MISSING');
  throw new Error('Missing Supabase environment variables')
}

if (!supabaseAnonKey) {
  console.warn('SUPABASE_ANON_KEY not found. Auth client operations may fail.');
}

console.log('Initializing Supabase client with service role key');
console.log('URL:', supabaseUrl);
console.log('Service role key prefix:', supabaseServiceKey.substring(0, 20) + '...');

// Configure fetch to handle self-signed certificates in development
const customFetch = (url, options = {}) => {
  // In Node.js, bypass SSL certificate validation for development
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  return fetch(url, options);
};

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  }
})

export const supabaseService = supabase

export const supabaseAuth = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { fetch: customFetch }
    })
  : null

// Database adapter following the pattern from copilot-instructions.md
export const db = {
  // Generic query method
  query: async (sql, params) => {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql, params })
    if (error) throw error
    return data
  },

  // Families operations
  families: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },

    create: async (family) => {
      const { data, error } = await supabase
        .from('families')
        .insert(family)
        .select()
        .single()
      if (error) throw error
      return data
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('families')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    delete: async (id) => {
      const { data, error } = await supabase
        .from('families')
        .delete()
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Family not found')
      }
    },

    getMembers: async (familyId) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('family_id', familyId)
        .order('full_name')
      if (error) throw error
      return data
    }
  },

  // Users operations
  users: {
    getAll: async (filters = {}) => {
      let query = supabase
        .from('users')
        .select('*, families(*)')
        .order('full_name')
      
      if (filters.familyId) {
        query = query.eq('family_id', filters.familyId)
      }
      
      if (filters.noFamily) {
        query = query.is('family_id', null)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('users')
        .select('*, families(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },

    getByEmail: async (email) => {
      const { data, error } = await supabase
        .from('users')
        .select('*, families(*)')
        .eq('email', email)
        .single()
      if (error) throw error
      return data
    },

    create: async (user) => {
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single()
      if (error) throw error
      return data
    },

    update: async (id, updates) => {
      const { data, error} = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
      if (error) throw error
    }
  },

  // Books operations
  books: {
    getAll: async (filters = {}) => {
      let query = supabase
        .from('books_view')
        .select('*, families(name, phone, whatsapp, email)')

      if (filters.familyId) {
        query = query.eq('family_id', filters.familyId)
      }

      if (filters.ids?.length) {
        query = query.in('id', filters.ids)
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else if (filters.status !== 'all') {
          query = query.eq('status', filters.status)
        }
      }

      if (filters.title) {
        query = query.ilike('title', `%${filters.title}%`)
      }

      if (filters.author) {
        query = query.ilike('author', `%${filters.author}%`)
      }

      if (filters.genre && filters.genre !== 'all') {
        query = query.eq('genre', filters.genre)
      }

      if (filters.ageRange && filters.ageRange !== 'all') {
        query = query.eq('age_range', filters.ageRange)
      }

      if (filters.series) {
        query = query.ilike('series', `%${filters.series}%`)
      }

      if (filters.search) {
        const term = filters.search.trim()
        if (term) {
          query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%,series.ilike.%${term}%`)
        }
      }

      if (filters.orderBy) {
        query = query.order(filters.orderBy, { ascending: filters.orderDir !== 'desc' })
      } else {
        query = query.order('title')
      }

      if (typeof filters.limit === 'number') {
        const from = typeof filters.offset === 'number' ? filters.offset : 0
        const to = from + filters.limit - 1
        query = query.range(from, to)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('books_view')
        .select('*, families(name, phone, whatsapp, email)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },

    create: async (book) => {
      // Implement deduplication logic
      // 1. Check if book exists in catalog using find_book_in_catalog()
      const { data: existingBookId, error: searchError } = await supabase
        .rpc('find_book_in_catalog', {
          p_title: book.title,
          p_author: book.author || '',
          p_isbn: book.isbn || null,
          p_series: book.series || null,
          p_series_number: book.series_number || null
        })

      if (searchError) throw searchError

      let catalogId = existingBookId

      // 2. If book doesn't exist in catalog, create it
      if (!catalogId) {
        // Validate ISBN: convert 0, '0', or empty string to null
        let cleanIsbn = book.isbn
        if (!cleanIsbn || cleanIsbn === 0 || cleanIsbn === '0' || cleanIsbn === '') {
          cleanIsbn = null
        }

        const catalogBook = {
          title: book.title,
          title_hebrew: book.title_hebrew,
          author: book.author,
          author_hebrew: book.author_hebrew,
          isbn: cleanIsbn,
          publisher: book.publisher,
          year_published: book.publish_year,
          genre: book.genre,
          age_level: book.age_range,
          pages: book.pages,
          summary: book.description,
          cover_image_url: book.cover_image_url,
          series: book.series,
          series_number: book.series_number
        }

        const { data: newCatalogEntry, error: catalogError } = await supabase
          .from('book_catalog')
          .insert(catalogBook)
          .select()
          .single()

        if (catalogError) throw catalogError
        catalogId = newCatalogEntry.id
      }

      // 3. Check if family already has this book
      const { data: existingFamilyBook, error: checkError } = await supabase
        .from('family_books')
        .select('id')
        .eq('family_id', book.family_id)
        .eq('book_catalog_id', catalogId)
        .maybeSingle()

      if (checkError) throw checkError

      let familyBookData

      if (existingFamilyBook) {
        // Family already has this book - return existing entry
        const { data: existing, error: existingError } = await supabase
          .from('family_books')
          .select()
          .eq('id', existingFamilyBook.id)
          .single()

        if (existingError) throw existingError
        familyBookData = existing
      } else {
        // 3a. Create family_books record (this family now owns this book)
        const familyBook = {
          family_id: book.family_id,
          book_catalog_id: catalogId,
          status: book.status || 'available',
          condition: book.condition,
          notes: book.notes,
          acquired_date: book.acquired_date
        }

        const { data: newFamilyBook, error: familyBookError } = await supabase
          .from('family_books')
          .insert(familyBook)
          .select()
          .single()

        if (familyBookError) throw familyBookError
        familyBookData = newFamilyBook
      }

      // 4. Return combined view data
      const { data: fullBook, error: viewError } = await supabase
        .from('books_view')
        .select('*')
        .eq('id', familyBookData.id)
        .single()

      if (viewError) throw viewError
      
      // Add flags to indicate status
      return {
        ...fullBook,
        _merged: existingBookId !== null,
        _alreadyOwned: existingFamilyBook !== null
      }
    },

    update: async (id, updates) => {
      // Split updates into catalog fields vs family-specific fields
      const catalogFields = {
        title: updates.title,
        title_hebrew: updates.title_hebrew,
        author: updates.author,
        author_hebrew: updates.author_hebrew,
        isbn: updates.isbn,
        publisher: updates.publisher,
        year_published: updates.publish_year,
        genre: updates.genre,
        age_level: updates.age_range,
        pages: updates.pages,
        summary: updates.description,
        cover_image_url: updates.cover_image_url,
        series: updates.series,
        series_number: updates.series_number
      }

      const familyFields = {
        status: updates.status,
        condition: updates.condition,
        notes: updates.notes,
        acquired_date: updates.acquired_date
      }

      // Remove undefined fields
      Object.keys(catalogFields).forEach(key => 
        catalogFields[key] === undefined && delete catalogFields[key]
      )
      Object.keys(familyFields).forEach(key => 
        familyFields[key] === undefined && delete familyFields[key]
      )

      // Get the book_catalog_id from family_books
      const { data: familyBook, error: fbError } = await supabase
        .from('family_books')
        .select('book_catalog_id')
        .eq('id', id)
        .single()

      if (fbError) throw fbError

      // Update catalog if there are catalog fields
      if (Object.keys(catalogFields).length > 0) {
        const { error: catalogError } = await supabase
          .from('book_catalog')
          .update(catalogFields)
          .eq('id', familyBook.book_catalog_id)

        if (catalogError) throw catalogError
      }

      // Update family_books if there are family-specific fields
      if (Object.keys(familyFields).length > 0) {
        const { error: familyError } = await supabase
          .from('family_books')
          .update(familyFields)
          .eq('id', id)

        if (familyError) throw familyError
      }

      // Return the updated book from the view
      const { data, error } = await supabase
        .from('books_view')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },

    delete: async (id) => {
      // Only delete the family_books record
      // Keep the book_catalog entry for other families
      const { data, error } = await supabase
        .from('family_books')
        .delete()
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Book not found')
      }
      return data
    },

    search: async (searchTerm) => {
      const { data, error } = await supabase
        .from('books_view')
        .select('*, families(name, phone, whatsapp)')
        .or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('title')
      if (error) throw error
      return data
    }
  },

  // Loans operations
  loans: {
    getAll: async (filters = {}) => {
      let query = supabase
        .from('loans')
        .select(`
          *,
          family_books!family_book_id(
            id,
            book_catalog(title, title_hebrew, author, cover_image_url)
          ),
          borrower_family:families!borrower_family_id(name, phone, whatsapp),
          owner_family:families!owner_family_id(name, phone, whatsapp)
        `)

      if (filters.borrowerFamilyId) query = query.eq('borrower_family_id', filters.borrowerFamilyId)
      if (filters.ownerFamilyId) query = query.eq('owner_family_id', filters.ownerFamilyId)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.bookIds?.length) query = query.in('family_book_id', filters.bookIds)
      if (filters.bookId) query = query.eq('family_book_id', filters.bookId)

      query = query.order('request_date', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      
      // Return with nested structure for frontend
      return data || []
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          family_books!family_book_id(
            id,
            book_catalog(title, title_hebrew, author, cover_image_url)
          ),
          borrower_family:families!borrower_family_id(name, phone, whatsapp),
          owner_family:families!owner_family_id(name, phone, whatsapp),
          requester:users(full_name, email, phone)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      
      return data
    },

    create: async (loan) => {
      // Convert book_id to family_book_id if needed
      if (loan.book_id && !loan.family_book_id) {
        loan.family_book_id = loan.book_id
        delete loan.book_id
      }
      
      const { data, error } = await supabase
        .from('loans')
        .insert(loan)
        .select()
        .single()
      if (error) {
        console.error('Supabase error creating loan:', error);
        throw error;
      }
      return data
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('loans')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', id)
      if (error) throw error
    }
  },

  // Reviews operations
  reviews: {
    getByBookId: async (bookId) => {
      // bookId here is actually the book_catalog_id from books_view
      // We need to get the book_catalog_id from the family_books record
      const { data: familyBook, error: fbError } = await supabase
        .from('family_books')
        .select('book_catalog_id')
        .eq('id', bookId)
        .single()

      if (fbError) {
        // If the ID is not a family_books ID, assume it's already a catalog ID
        // This handles direct catalog ID queries
        const { data, error } = await supabase
          .from('reviews')
          .select('*, users(full_name)')
          .eq('book_catalog_id', bookId)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data
      }

      // Query reviews for the catalog book
      const { data, error } = await supabase
        .from('reviews')
        .select('*, users(full_name)')
        .eq('book_catalog_id', familyBook.book_catalog_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },

    create: async (review) => {
      // If book_id is provided, convert it to book_catalog_id
      let catalogId = review.book_catalog_id || review.book_id

      if (!review.book_catalog_id && review.book_id) {
        const { data: familyBook, error: fbError } = await supabase
          .from('family_books')
          .select('book_catalog_id')
          .eq('id', review.book_id)
          .single()

        if (fbError) {
          // Assume it's already a catalog ID
          catalogId = review.book_id
        } else {
          catalogId = familyBook.book_catalog_id
        }
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          book_catalog_id: catalogId,
          user_id: review.user_id,
          rating: review.rating,
          review_text: review.review_text
        })
        .select()
        .single()
      if (error) throw error
      return data
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    delete: async (id) => {
      const { data, error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Review not found')
      }
      return data
    }
  },

  // Likes operations
  likes: {
    getByBookId: async (bookId) => {
      // bookId here is the family_books ID, get the catalog ID
      const { data: familyBook, error: fbError } = await supabase
        .from('family_books')
        .select('book_catalog_id')
        .eq('id', bookId)
        .single()

      if (fbError) {
        // Assume it's already a catalog ID
        const { data, error } = await supabase
          .from('likes')
          .select('*, users(full_name)')
          .eq('book_catalog_id', bookId)
        if (error) throw error
        return data
      }

      const { data, error } = await supabase
        .from('likes')
        .select('*, users(full_name)')
        .eq('book_catalog_id', familyBook.book_catalog_id)
      if (error) throw error
      return data
    },

    toggle: async (bookId, userId) => {
      // Get the book_catalog_id
      const { data: familyBook, error: fbError } = await supabase
        .from('family_books')
        .select('book_catalog_id')
        .eq('id', bookId)
        .single()

      let catalogId = bookId
      if (!fbError) {
        catalogId = familyBook.book_catalog_id
      }

      // Check if like exists
      const { data: existing } = await supabase
        .from('likes')
        .select('id')
        .eq('book_catalog_id', catalogId)
        .eq('user_id', userId)
        .single()

      if (existing) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('book_catalog_id', catalogId)
          .eq('user_id', userId)
        if (error) throw error
        return { liked: false }
      } else {
        // Like
        const { data, error } = await supabase
          .from('likes')
          .insert({ book_catalog_id: catalogId, user_id: userId })
          .select()
          .single()
        if (error) throw error
        return { liked: true, data }
      }
    }
  }
}
