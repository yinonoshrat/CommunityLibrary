import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

const appModule = await import('../index.js')
const app = appModule.default

describe('Reviews and Likes API Endpoints', () => {
  let testUserId = null
  let testUser2Id = null
  let testFamilyId = null
  let testBookId = null
  let testReviewId = null

  beforeAll(async () => {
    // Create test user 1
    const timestamp = Date.now()
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reviewtest1${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Review Test User 1',
        phone: '1111111111',
        familyName: 'Review Test Family'
      })

    testUserId = user1Response.body.user?.id
    testFamilyId = user1Response.body.family_id

    // Create test user 2
    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reviewtest2${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Review Test User 2',
        phone: '2222222222',
        familyName: 'Review Test Family 2'
      })

    testUser2Id = user2Response.body.user.id

    // Create a test book
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
  })

  describe('GET /api/books/:bookId/reviews', () => {
    it('should return 200 and array of reviews', async () => {
      if (!testBookId) return

      const response = await request(app)
        .get(`/api/books/${testBookId}/reviews`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('reviews')
      expect(Array.isArray(response.body.reviews)).toBe(true)
    })

    it('should return empty array for book with no reviews', async () => {
      if (!testBookId) return

      const response = await request(app)
        .get(`/api/books/${testBookId}/reviews`)
        .expect(200)

      expect(response.body.reviews).toHaveLength(0)
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id/reviews')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })

    it('should always return valid JSON', async () => {
      if (!testBookId) return

      const response = await request(app)
        .get(`/api/books/${testBookId}/reviews`)
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('POST /api/books/:bookId/reviews', () => {
    it('should create review with valid data including rating', async () => {
      if (!testBookId || !testUserId) return

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
      if (!testBookId) return

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
      if (!testBookId || !testUserId) return

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
      if (!testBookId || !testUserId) return

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
      if (!testBookId || !testUser2Id) return

      const response = await request(app)
        .post(`/api/books/${testBookId}/reviews`)
        .send({
          user_id: testUser2Id,
          rating: 1,
          review_text: 'Not my favorite book'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body.review.rating).toBe(1)
    })

    it('should prevent duplicate reviews from same user', async () => {
      if (!testBookId || !testUserId) return

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
      if (!testReviewId) return

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
      if (!testReviewId) return

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
      if (!testReviewId) return

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
      if (!testBookId) return

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
      if (!testBookId) return

      const response = await request(app)
        .get(`/api/books/${testBookId}/likes`)
        .expect(200)

      expect(response.body.count).toBe(0)
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
      if (!testBookId || !testUserId) return

      const response = await request(app)
        .post(`/api/books/${testBookId}/likes`)
        .send({
          user_id: testUserId
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('liked')
      expect(response.body.liked).toBe(true)
    })

    it('should toggle like (remove like)', async () => {
      if (!testBookId || !testUserId) return

      const response = await request(app)
        .post(`/api/books/${testBookId}/likes`)
        .send({
          user_id: testUserId
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('liked')
      expect(response.body.liked).toBe(false)
    })

    it('should return JSON error for missing user_id', async () => {
      if (!testBookId) return

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
      if (!testBookId || !testUser2Id) return

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

