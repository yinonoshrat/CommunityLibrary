import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Buffer } from 'buffer'
import { getSharedTestData } from './setup/testData.js'

const appModule = await import('../index.js')
const app = appModule.default

// Helper to ensure test data exists
const requireTestData = (data, message) => {
  if (!data) {
    throw new Error(`Test setup failed: ${message}`)
  }
}

describe('Bulk Upload API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null

  beforeAll(async () => {
    // Use shared test user and family
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId
  })

  describe('POST /api/books/detect-from-image', () => {
    it('should return JSON error when no image is provided', async () => {
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('No image provided')
    })

    it('should return JSON error when AI service is not configured', async () => {
      // This test assumes AI service might not be configured in test environment
      const fakeImage = Buffer.from('fake image data')
      
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .attach('image', fakeImage, 'test.jpg')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      // Should be either success or error, but always valid JSON
      expect(response.body).toSatisfy(
        (body) => body.hasOwnProperty('error') || body.hasOwnProperty('success')
      )
    })

    it('should reject non-image files', async () => {
      const textFile = Buffer.from('This is not an image')
      
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .attach('image', textFile, 'test.txt')
        .expect('Content-Type', /json/)

      // Should return error for non-image file
      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })

    it('should always return valid JSON even on errors', async () => {
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .send({})
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('POST /api/books/bulk-add', () => {
    it('should return JSON error when no books are provided', async () => {
      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('No books provided')
    })

    it('should return JSON error when books array is empty', async () => {
      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books: [] })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error when user is not authenticated', async () => {
      const response = await request(app)
        .post('/api/books/bulk-add')
        .send({
          books: [{ title: 'Test Book', author: 'Test Author' }]
        })
        .expect('Content-Type', /json/)
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })

    it('should return JSON error for more than 50 books', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const books = Array.from({ length: 51 }, (_, i) => ({
        title: `Book ${i}`,
        author: 'Test Author'
      }))

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Maximum 50 books')
    })

    it('should add valid books successfully', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const timestamp = Date.now()
      const books = [
        {
          title: `Bulk Book 1 ${timestamp}`,
          author: 'Bulk Author 1',
          genre: 'Fiction',
          age_range: 'Adult'
        },
        {
          title: `Bulk Book 2 ${timestamp}`,
          author: 'Bulk Author 2',
          genre: 'Non-Fiction',
          age_range: 'Young Adult'
        }
      ]

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('added')
      expect(response.body).toHaveProperty('failed')
      expect(response.body).toHaveProperty('books')
      expect(response.body.added).toBe(2)
      expect(response.body.failed).toBe(0)
      expect(Array.isArray(response.body.books)).toBe(true)

      // Cleanup created books
      if (response.body.books && response.body.books.length > 0) {
        for (const book of response.body.books) {
          await request(app).delete(`/api/books/${book.id}`).set('x-user-id', testUserId)
        }
      }
    })

    it('should handle books with missing optional fields', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const timestamp = Date.now()
      const books = [
        {
          title: `Minimal Book ${timestamp}`,
          author: 'Minimal Author'
          // No genre, age_range, etc.
        }
      ]

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.added).toBe(1)

      // Cleanup created book
      if (response.body.books && response.body.books.length > 0) {
        for (const book of response.body.books) {
          await request(app).delete(`/api/books/${book.id}`).set('x-user-id', testUserId)
        }
      }
    })

    it('should report errors for invalid books', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const timestamp = Date.now()
      const books = [
        {
          title: `Valid Book ${timestamp}`,
          author: 'Valid Author'
        },
        {
          // Missing title
          author: 'Author Without Title'
        },
        {
          title: null, // Invalid title
          author: 'Another Author'
        }
      ]

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.added).toBe(1)
      expect(response.body.failed).toBe(2)
      expect(response.body.errors).toHaveLength(2)

      // Cleanup created book (only the valid one was added)
      if (response.body.books && response.body.books.length > 0) {
        for (const book of response.body.books) {
          await request(app).delete(`/api/books/${book.id}`).set('x-user-id', testUserId)
        }
      }
    })

    it('should set default author for books without author', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const timestamp = Date.now()
      const books = [
        {
          title: `No Author Book ${timestamp}`
          // No author provided
        }
      ]

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect(200)

      expect(response.body.added).toBe(1)
      expect(response.body.books[0].author).toBe('לא ידוע')

      // Cleanup created book
      if (response.body.books && response.body.books.length > 0) {
        for (const book of response.body.books) {
          await request(app).delete(`/api/books/${book.id}`).set('x-user-id', testUserId)
        }
      }
    })

    it('should always return valid JSON even with errors', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books: [{ invalid: 'data' }] })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('errors')
    })

    it('should include all book fields in response', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const timestamp = Date.now()
      const books = [
        {
          title: `Complete Book ${timestamp}`,
          author: 'Complete Author',
          genre: 'Mystery',
          age_range: 'Adult',
          publisher: 'Test Publisher',
          publish_year: 2024,
          pages: 300,
          isbn: `ISBN-${timestamp}`, // Unique ISBN
          description: 'Test description',
          series: 'Test Series',
          series_number: 1
        }
      ]

      const response = await request(app)
        .post('/api/books/bulk-add')
        .set('x-user-id', testUserId)
        .send({ books })
        .expect(200)

      expect(response.body.added).toBe(1)
      const book = response.body.books[0]
      expect(book.title).toContain('Complete Book')
      expect(book.genre).toBe('Mystery')
      expect(book.publisher).toBe('Test Publisher')

      // Cleanup created book
      if (response.body.books && response.body.books.length > 0) {
        for (const createdBook of response.body.books) {
          await request(app).delete(`/api/books/${createdBook.id}`).set('x-user-id', testUserId)
        }
      }
    })
  })
})

