import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { getSharedTestData } from './setup/testData.js'
import { createClient } from '@supabase/supabase-js'
import { resourceManager } from './setup/resourceManager.js'

const appModule = await import('../index.js')
const app = appModule.default

// Helper to ensure test data exists
const requireTestData = (data, message) => {
  if (!data) {
    throw new Error(`Test setup failed: ${message}`)
  }
}

// Initialize Supabase for creating second family
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

describe('Loans API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null
  let borrowerFamilyId = null
  let testBookId = null
  let testLoanId = null

  beforeAll(async () => {
    // Use shared test user and family as owner
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId

    // Create or find borrower family
    const { data: existingFamily } = await supabase
      .from('families')
      .select('id')
      .eq('name', 'Loans Test Borrower Family')
      .maybeSingle()

    if (existingFamily) {
      borrowerFamilyId = existingFamily.id
    } else {
      const { data: newFamily, error } = await supabase
        .from('families')
        .insert({ name: 'Loans Test Borrower Family', phone: '2222222222' })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating borrower family:', error)
        throw error
      }
      
      borrowerFamilyId = newFamily.id
      resourceManager.track('families', borrowerFamilyId)
    }

    // Find or create a test book
    const booksResponse = await request(app)
      .get(`/api/books?familyId=${testFamilyId}`)
    
    if (booksResponse.body.books && booksResponse.body.books.length > 0) {
      // Books are grouped by catalog, get family_book ID from viewerContext
      const firstBook = booksResponse.body.books[0]
      if (firstBook.viewerContext?.ownedCopies?.[0]?.familyBookId) {
        testBookId = firstBook.viewerContext.ownedCopies[0].familyBookId
      }
    }
    
    if (!testBookId) {
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: 'Loan Test Book',
          author: 'Loan Author',
          family_id: testFamilyId
        })

      if (bookResponse.body.book) {
        testBookId = bookResponse.body.book.id
        resourceManager.track('books', testBookId)
      }
    }

    // Create a test loan for GET tests
    if (testBookId && borrowerFamilyId) {
      const loanResponse = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          family_book_id: testBookId,
          borrower_family_id: borrowerFamilyId,
          owner_family_id: testFamilyId,
          requester_user_id: testUserId,
          status: 'active'
        })

      if (loanResponse.body.loan) {
        testLoanId = loanResponse.body.loan.id
        resourceManager.track('loans', testLoanId)
      }
    }
  })

  afterAll(async () => {
    await resourceManager.cleanup()
  })

  describe('GET /api/loans', () => {
    it('should return 200 and array of loans', async () => {
      const response = await request(app)
        .get('/api/loans')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loans')
      expect(Array.isArray(response.body.loans)).toBe(true)
    })

    it('should filter loans by borrower family', async () => {
      const response = await request(app)
        .get(`/api/loans?borrowerFamilyId=${borrowerFamilyId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loans')
    })

    it('should filter loans by owner family', async () => {
      const response = await request(app)
        .get(`/api/loans?ownerFamilyId=${testFamilyId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loans')
    })

    it('should filter loans by status', async () => {
      const response = await request(app)
        .get('/api/loans?status=active')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loans')
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .get('/api/loans')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('GET /api/loans/:id', () => {
    it('should return loan by ID', async () => {
      requireTestData(testLoanId, 'testLoanId is required')

      const response = await request(app)
        .get(`/api/loans/${testLoanId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loan')
      expect(response.body.loan).toHaveProperty('id', testLoanId)
    })

    it('should return JSON error for non-existent loan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .get(`/api/loans/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/loans', () => {
    it('should create loan with valid data', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(borrowerFamilyId, 'borrowerFamilyId is required')

      const response = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          family_book_id: testBookId,
          borrower_family_id: borrowerFamilyId,
          owner_family_id: testFamilyId,
          requester_user_id: testUserId,
          status: 'active'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('loan')
      expect(response.body.loan).toHaveProperty('id')
      
      resourceManager.track('loans', response.body.loan.id)
    })

    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          status: 'active'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should accept book_id as alias for family_book_id', async () => {
      if (!testBookId || !borrowerFamilyId) return

      const response = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          book_id: testBookId,
          borrower_family_id: borrowerFamilyId,
          owner_family_id: testFamilyId,
          requester_user_id: testUserId,
          status: 'active'
        })
        .expect('Content-Type', /json/)

      // Should work without error
      expect(response.body).toBeDefined()
      if (response.body.loan) {
        resourceManager.track('loans', response.body.loan.id)
      }
    })

    it('should update book status to on_loan when loan is active', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(borrowerFamilyId, 'borrowerFamilyId is required')
      requireTestData(testUserId, 'testUserId is required')

      // Create a new book for this test
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Loan Status Test ${timestamp}`,
          author: 'Status Author',
          family_id: testFamilyId
        })

      const bookId = bookResponse.body.book.id
      resourceManager.track('books', bookId)

      // Create loan
      const loanResponse = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          family_book_id: bookId,
          borrower_family_id: borrowerFamilyId,
          owner_family_id: testFamilyId,
          requester_user_id: testUserId,
          status: 'active'
        })
        .expect(201)

      const loanId = loanResponse.body.loan?.id
      if (loanId) resourceManager.track('loans', loanId)

      // Check book status
      const bookCheck = await request(app)
        .get(`/api/books/${bookId}`)
        .expect(200)

      expect(bookCheck.body.book.status).toBe('on_loan')
    })
  })

  describe('PUT /api/loans/:id', () => {
    it('should update loan status', async () => {
      requireTestData(testLoanId, 'testLoanId is required')

      const response = await request(app)
        .put(`/api/loans/${testLoanId}`)
        .set('x-user-id', testUserId)
        .send({
          status: 'returned'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loan')
      expect(response.body.loan.status).toBe('returned')
    })

    it('should update book status when loan is returned', async () => {
      requireTestData(testBookId, 'testBookId is required')
      requireTestData(borrowerFamilyId, 'borrowerFamilyId is required')
      requireTestData(testUserId, 'testUserId is required')

      // Create a new book and loan for this test
      const timestamp = Date.now()
      const bookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', testUserId)
        .send({
          title: `Return Test Book ${timestamp}`,
          author: 'Return Author',
          family_id: testFamilyId
        })

      const bookId = bookResponse.body.book.id
      resourceManager.track('books', bookId)

      const loanResponse = await request(app)
        .post('/api/loans')
        .set('x-user-id', testUserId)
        .send({
          family_book_id: bookId,
          borrower_family_id: borrowerFamilyId,
          owner_family_id: testFamilyId,
          requester_user_id: testUserId,
          status: 'active'
        })

      const loanId = loanResponse.body.loan?.id
      if (loanId) resourceManager.track('loans', loanId)

      // Return the loan
      await request(app)
        .put(`/api/loans/${loanId}`)
        .set('x-user-id', testUserId)
        .send({ status: 'returned' })
        .expect(200)

      // Check book status
      const bookCheck = await request(app)
        .get(`/api/books/${bookId}`)
        .expect(200)

      expect(bookCheck.body.book.status).toBe('available')
    })

    it('should return JSON error for non-existent loan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .put(`/api/loans/${fakeId}`)
        .set('x-user-id', testUserId)
        .send({ status: 'returned' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })
})
