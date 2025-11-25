import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

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
      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', id)
      if (error) throw error
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
    getAll: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*, families(*)')
        .order('full_name')
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
        .from('books')
        .select('*, families(name, phone, whatsapp)')

      if (filters.familyId) query = query.eq('family_id', filters.familyId)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.title) query = query.ilike('title', `%${filters.title}%`)
      if (filters.author) query = query.ilike('author', `%${filters.author}%`)
      if (filters.genre) query = query.eq('genre', filters.genre)
      if (filters.series) query = query.ilike('series', `%${filters.series}%`)

      query = query.order('title')

      const { data, error } = await query
      if (error) throw error
      return data
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('books')
        .select('*, families(name, phone, whatsapp, email)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },

    create: async (book) => {
      const { data, error } = await supabase
        .from('books')
        .insert(book)
        .select()
        .single()
      if (error) throw error
      return data
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', id)
      if (error) throw error
    },

    search: async (searchTerm) => {
      const { data, error } = await supabase
        .from('books')
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
          books(title, title_hebrew, author),
          borrower_family:families!borrower_family_id(name, phone),
          owner_family:families!owner_family_id(name, phone),
          requester:users(full_name, email)
        `)

      if (filters.borrowerFamilyId) query = query.eq('borrower_family_id', filters.borrowerFamilyId)
      if (filters.ownerFamilyId) query = query.eq('owner_family_id', filters.ownerFamilyId)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.bookId) query = query.eq('book_id', filters.bookId)

      query = query.order('request_date', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      return data
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          books(title, title_hebrew, author, cover_image_url),
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
      const { data, error } = await supabase
        .from('loans')
        .insert(loan)
        .select()
        .single()
      if (error) throw error
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
      const { data, error } = await supabase
        .from('reviews')
        .select('*, users(full_name)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },

    create: async (review) => {
      const { data, error } = await supabase
        .from('reviews')
        .insert(review)
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
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id)
      if (error) throw error
    }
  },

  // Likes operations
  likes: {
    getByBookId: async (bookId) => {
      const { data, error } = await supabase
        .from('likes')
        .select('*, users(full_name)')
        .eq('book_id', bookId)
      if (error) throw error
      return data
    },

    toggle: async (bookId, userId) => {
      // Check if like exists
      const { data: existing } = await supabase
        .from('likes')
        .select('id')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single()

      if (existing) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('book_id', bookId)
          .eq('user_id', userId)
        if (error) throw error
        return { liked: false }
      } else {
        // Like
        const { data, error } = await supabase
          .from('likes')
          .insert({ book_id: bookId, user_id: userId })
          .select()
          .single()
        if (error) throw error
        return { liked: true, data }
      }
    }
  }
}
