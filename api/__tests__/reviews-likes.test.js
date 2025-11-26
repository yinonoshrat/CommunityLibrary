import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getSharedTestData } from './setup/testData.js'
import { createClient } from '@supabase/supabase-js'

const appModule = await import('../index.js')
const app = appModule.default

// Helper to ensure test data exists
const requireTestData = (data, message) => {
  if (!data) {
    throw new Error(`Test setup failed: ${message}`)
  }
}

// Initialize Supabase for creating second user
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

describe('Reviews and Likes API Endpoints', () => {
  let testUserId = null
  let testUser2Id = null
  let testFamilyId = null
  let testBookId = null
  let testReviewId = null

  beforeAll(async () => {
    // Use shared test user
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId

    // Create or find second user for multi-user tests
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'reviewtest2@testfamily.com')
      .maybeSingle()

    if (existingUser) {
      testUser2Id = existingUser.id
    } else {
      // Create second user via Admin API
      const { data: authUser } = await supabase.auth.admin.createUser({
        email: 'reviewtest2@testfamily.com',
        password: 'testpass123',
        email_confirm: true
      })

      // Create family for second user
      const { data: family2 } = await supabase
        .from('families')
        .insert({ name: 'Review Test Family 2', phone: '2222222222' })
        .select()
        .single()

      // Insert user record
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: 'reviewtest2@testfamily.com',
          auth_email: 'reviewtest2@testfamily.com',
          full_name: 'Review Test User 2',
          phone: '2222222222',
          whatsapp: '2222222222',
          family_id: family2.id,
          is_family_admin: true
        })
        .select()
        .single()
      
      testUser2Id = newUser.id
    }

    // Get existing book or create a test book
    const booksResponse = await request(app)
      .get(`/api/books?familyId=${testFamilyId}`)
    
    if (booksResponse.body.books && booksResponse.body.books.length > 0) {
      testBookId = booksResponse.body.books[0].id
    } else {
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: 'Review Test Book',
          author: 'Review Author',
          family_id: testFamilyId
        })

      if (bookResponse.body.book) {
        testBookId = bookResponse.body.book.id
      }
    }
  })

  describe('GET /api/books/:bookId/reviews', () => {
    it('should return 200 and array of reviews', async () => {
      requireTestData(testBookId, 'testBookId is required')

      const response = await request(app)
        .get(`/api/books/${testBookId}/reviews`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('reviews')
      expect(Array.isArray(response.body.reviews)).toBe(true)
    })

    it('should return empty array for book with no reviews', async () => {
      requireTestData(testBookId, 'testBookId is required')

      // Create a new book that definitely has no reviews
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `No Reviews Book ${timestamp}`,
          author: 'No Reviews Author',
          family_id: testFamilyId
        })

      const newBookId = bookResponse.body.book.id

      const response = await request(app)
        .get(`/api/books/${newBookId}/reviews`)
        .expect(200)

      expect(response.body.reviews).toHaveLength(0)

      // Cleanup
      await request(app).delete(`/api/books/${newBookId}`).set('x-user-id', testUserId)
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id/reviews')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })

    it('should always return valid JSON', async () => {
      requireTestData(testBookId, 'testBookId is required')

      const response = await request(app)
        .get(`/api/books/${testBookId}/reviews`)
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('POST /api/books/:bookId/reviews', () => {
    it('should create review with valid data including rating', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          user_id: testUserId,
          rating: 5,
          review_text: 'This is a great book!'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('review')
      expect(response.body.review).toHaveProperty('id')
      expect(response.body.review.rating).toBe(5)
      expect(response.body.review.review_text).toBe('This is a great book!')
      testReviewId = response.body.review.id
    })

    it('should return JSON error for missing required fields', async () => {
      requireTestData(testBookId, 'testBookId is required')

      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          review_text: 'Review without user_id'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for invalid rating', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          user_id: testUserId,
          rating: 10, // Invalid: should be 1-5
          review_text: 'Invalid rating test'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for rating less than 1', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          user_id: testUserId,
          rating: 0,
          review_text: 'Zero rating test'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle reviews with minimum rating (1 star)', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUser2Id, 'testUser2Id is required')

      // Create a new book for this test to avoid duplicate review issues
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Min Rating Book ${timestamp}`,
          author: 'Test Author',
          family_id: testFamilyId
        })
      
      const newBookId = bookResponse.body.book.id

      const response = await request(app)
        .post(`/api/books/${newBookId}/reviews`)
        .send({
          user_id: testUser2Id,
          rating: 1,
          review_text: 'Not my favorite book'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body.review.rating).toBe(1)

      // Cleanup
      await request(app).delete(`/api/books/${newBookId}`).set('x-user-id', testUserId)
    })

    it('should prevent duplicate reviews from same user', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUserId, 'testUserId is required')

      // Try to create another review by the same user
      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          user_id: testUserId,
          rating: 4,
          review_text: 'Trying to add another review'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .post('/api/books/invalid-id/reviews')
        .send({
          user_id: testUserId,
          rating: 5,
          review_text: 'Test review'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/reviews/:id', () => {
    it('should update review with new rating and text', async () => {
      requireTestData(testReviewId, 'testReviewId is required')

      const response = await request(app)
        .put(`/api/reviews/${testReviewId}`)
        .send({
          rating: 4,
          review_text: 'Updated review text'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('review')
      expect(response.body.review.rating).toBe(4)
      expect(response.body.review.review_text).toBe('Updated review text')
    })

    it('should return JSON error for invalid rating in update', async () => {
      requireTestData(testReviewId, 'testReviewId is required')

      const response = await request(app)
        .put(`/api/reviews/${testReviewId}`)
        .send({
          rating: 6 // Invalid
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for non-existent review', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .put(`/api/reviews/${fakeId}`)
        .send({
          rating: 3,
          review_text: 'Update non-existent'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/reviews/:id', () => {
    it('should delete review', async () => {
      requireTestData(testReviewId, 'testReviewId is required')

      const response = await request(app)
        .delete(`/api/reviews/${testReviewId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('deleted')
    })

    it('should return JSON error for non-existent review', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .delete(`/api/reviews/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/books/:bookId/likes', () => {
    it('should return likes for a book', async () => {
      requireTestData(testBookId, 'testBookId is required')

      const response = await request(app)
        .get(`/api/books/${testBookId}/likes`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('likes')
      expect(response.body).toHaveProperty('count')
      expect(Array.isArray(response.body.likes)).toBe(true)
      expect(typeof response.body.count).toBe('number')
    })

    it('should return zero count for book with no likes', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Create a new book with no likes
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `No Likes Book ${timestamp}`,
          author: 'No Likes Author',
          family_id: testFamilyId
        })

      const newBookId = bookResponse.body.book.id

      const response = await request(app)
        .get(`/api/books/${newBookId}/likes`)
        .expect(200)

      expect(response.body.count).toBe(0)

      // Cleanup
      await request(app).delete(`/api/books/${newBookId}`).set('x-user-id', testUserId)
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id/likes')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/books/:bookId/likes', () => {
    it('should toggle like (add like)', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Create a new book for this test
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Add Like Book ${timestamp}`,
          author: 'Like Test Author',
          family_id: testFamilyId
        })

      const newBookId = bookResponse.body.book.id

      const response = await request(app)
        .post(`/api/books/${newBookId}/likes`)
        .send({
          user_id: testUserId
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('liked')
      expect(response.body.liked).toBe(true)

      // Cleanup
      await request(app).delete(`/api/books/${newBookId}`).set('x-user-id', testUserId)
    })

    it('should toggle like (remove like)', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Create a new book and add a like first
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Remove Like Book ${timestamp}`,
          author: 'Unlike Test Author',
          family_id: testFamilyId
        })

      const newBookId = bookResponse.body.book.id

      // Add like first
      await request(app)
        .post(`/api/books/${newBookId}/likes`)
        .send({ user_id: testUserId })

      // Remove like
      const response = await request(app)
        .post(`/api/books/${newBookId}/likes`)
        .send({
          user_id: testUserId
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('liked')
      expect(response.body.liked).toBe(false)

      // Cleanup
      await request(app).delete(`/api/books/${newBookId}`).set('x-user-id', testUserId)
    })

    it('should return JSON error for missing user_id', async () => {
      requireTestData(testBookId, 'testBookId is required')

      const response = await request(app)
        .post(`/api/books/${testBookId}/likes`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .post('/api/books/invalid-id/likes')
        .send({
          user_id: testUserId
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should increment count when like is added', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(testUser2Id, 'testUser2Id is required')

      // Add like
      await request(app)
        .post(`/api/books/${testBookId}/likes`)
        .send({ user_id: testUser2Id })
        .expect(200)

      // Check count
      const response = await request(app)
        .get(`/api/books/${testBookId}/likes`)
        .expect(200)

      expect(response.body.count).toBeGreaterThan(0)
    })
  })
})

