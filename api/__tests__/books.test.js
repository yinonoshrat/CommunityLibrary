import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getSharedTestData, cleanupTestData } from './setup/testData.js'

const appModule = await import('../index.js')
const app = appModule.default

describe('Books API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null
  let testBookId = null

  beforeAll(async () => {
    // Use shared test user and family
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId

    // Try to find existing test book first
    const booksResponse = await request(app)
      .get(`/api/books?familyId=${testFamilyId}`)
    
    if (booksResponse.body.books && booksResponse.body.books.length > 0) {
      // Use first book from shared family - get familyBookId from viewerContext
      const firstBook = booksResponse.body.books[0]
      testBookId = firstBook.viewerContext?.ownedCopies?.[0]?.familyBookId || firstBook.id
    } else {
      // Create a test book if none exists
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: 'Test Book',
          author: 'Test Author',
          family_id: testFamilyId,
          genre: 'Fiction',
          age_range: 'Young Adult'
        })

      if (bookResponse.body.book) {
        testBookId = bookResponse.body.book.id
      }
    }
  })

  describe('GET /api/books', () => {
    it('should return 200 and array of books', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
      expect(Array.isArray(response.body.books)).toBe(true)
    })

    it('should filter books by familyId', async () => {
      const response = await request(app)
        .get(`/api/books?familyId=${testFamilyId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
      expect(Array.isArray(response.body.books)).toBe(true)
    })

    it('should filter books by status', async () => {
      const response = await request(app)
        .get('/api/books?status=available')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
    })

    it('should filter books by genre', async () => {
      const response = await request(app)
        .get('/api/books?genre=Fiction')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('GET /api/books/search', () => {
    it('should search books by title', async () => {
      const response = await request(app)
        .get('/api/books/search?q=Test')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
      expect(Array.isArray(response.body.books)).toBe(true)
    })

    it('should return JSON error when query is missing', async () => {
      const response = await request(app)
        .get('/api/books/search')
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Search query required')
    })

    it('should filter search results by genre', async () => {
      const response = await request(app)
        .get('/api/books/search?q=Test&genre=Fiction')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
    })

    it('should filter search results by availability', async () => {
      const response = await request(app)
        .get('/api/books/search?q=Test&available=true')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
    })

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/books/search?q=NonExistentBookTitle12345')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
      expect(response.body.books).toHaveLength(0)
    })
  })

  describe('GET /api/books/:id', () => {
    it('should return book by ID', async () => {
      const response = await request(app)
        .get(`/api/books/${testBookId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('book')
      expect(response.body.book).toHaveProperty('id', testBookId)
    })

    it('should return JSON error for non-existent book', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .get(`/api/books/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/books/:id/families', () => {
    it('should return families that have the book', async () => {
      const response = await request(app)
        .get(`/api/books/${testBookId}/families`)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('book')
      expect(response.body).toHaveProperty('families')
      expect(Array.isArray(response.body.families)).toBe(true)
    })

    it('should return JSON error for invalid book ID', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id/families')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/books', () => {
    it('should create book with valid data', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `New Book ${timestamp}`,
          author: 'New Author',
          family_id: testFamilyId,
          genre: 'Science Fiction',
          age_range: 'Adult'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('book')
      expect(response.body.book).toHaveProperty('id')
      expect(response.body.book.title).toContain('New Book')

      // Cleanup created book
      await request(app).delete(`/api/books/${response.body.book.id}`).set('x-user-id', testUserId)
    })

    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          author: 'Author Without Title'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle books without ISBN', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Book Without ISBN ${timestamp}`,
          author: 'Unknown Author',
          family_id: testFamilyId
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('book')

      // Cleanup created book
      await request(app).delete(`/api/books/${response.body.book.id}`).set('x-user-id', testUserId)
    })

    it('should set default status to available', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Status Test Book ${timestamp}`,
          author: 'Status Author',
          family_id: testFamilyId
        })
        .expect(201)

      expect(response.body.book.status).toBe('available')

      // Cleanup created book
      await request(app).delete(`/api/books/${response.body.book.id}`).set('x-user-id', testUserId)
    })
  })

  describe('PUT /api/books/:id', () => {
    it('should update book with valid data', async () => {
      const response = await request(app)
        .put(`/api/books/${testBookId}`)
        .set('x-user-id', testUserId)
        .send({
          genre: 'Updated Genre'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('book')
      expect(response.body.book.genre).toBe('Updated Genre')
    })

    it('should return JSON error for non-existent book', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .put(`/api/books/${fakeId}`)
        .set('x-user-id', testUserId)
        .send({ genre: 'New Genre' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/books/:id', () => {
    it('should delete book', async () => {
      // Create a book to delete
      const timestamp = Date.now()
      const createResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Delete Me ${timestamp}`,
          author: 'Delete Author',
          family_id: testFamilyId
        })
        .expect(201)

      const bookId = createResponse.body.book.id

      const response = await request(app)
        .delete(`/api/books/${bookId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('deleted')
    })

    it('should return JSON error for non-existent book', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .delete(`/api/books/${fakeId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })
})

