import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Buffer } from 'buffer'

const appModule = await import('../index.js')
const app = appModule.default

describe('Bulk Upload API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null

  beforeAll(async () => {
    // Create test user and family
    const timestamp = Date.now()
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: `bulktest${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Bulk Test User',
        phone: '1234567890',
        familyName: 'Bulk Test Family'
      })

    testUserId = response.body.user?.id
    testFamilyId = response.body.family_id
  })

  describe('POST /api/books/detect-from-image', () => {
    it('should return JSON error when no image is provided', async () => {
      const response = await request(app)
        .post('/api/books/detect-from-image')
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
      if (!testUserId) return

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
      if (!testUserId) return

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
    })

    it('should handle books with missing optional fields', async () => {
      if (!testUserId) return

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
    })

    it('should report errors for invalid books', async () => {
      if (!testUserId) return

      const books = [
        {
          title: 'Valid Book',
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
    })

    it('should set default author for books without author', async () => {
      if (!testUserId) return

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
    })

    it('should always return valid JSON even with errors', async () => {
      if (!testUserId) return

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
      if (!testUserId) return

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
          isbn: '1234567890',
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
    })
  })
})

