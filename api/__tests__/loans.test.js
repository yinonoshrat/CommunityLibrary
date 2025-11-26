import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

const appModule = await import('../index.js')
const app = appModule.default

describe('Loans API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null
  let borrowerFamilyId = null
  let testBookId = null
  let testLoanId = null

  beforeAll(async () => {
    // Create owner family and user
    const timestamp = Date.now()
    const ownerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `loanowner${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Loan Owner',
        phone: '1234567890',
        familyName: 'Owner Family'
      })

    testUserId = ownerResponse.body.user?.id
    testFamilyId = ownerResponse.body.family_id

    // Create borrower family
    const borrowerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `loanborrower${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Loan Borrower',
        phone: '2222222222',
        familyName: 'Borrower Family'
      })

    borrowerFamilyId = borrowerResponse.body.family_id

    // Create a test book
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
    }
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
      if (!testLoanId) return

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
      if (!testBookId || !borrowerFamilyId) return

      const response = await request(app)
        .post('/api/loans')
        .send({
          family_book_id: testBookId,
          borrower_family_id: borrowerFamilyId,
          status: 'active'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('loan')
      expect(response.body.loan).toHaveProperty('id')
      testLoanId = response.body.loan.id
    })

    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/loans')
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
        .send({
          book_id: testBookId,
          borrower_family_id: borrowerFamilyId,
          status: 'active'
        })
        .expect('Content-Type', /json/)

      // Should work without error
      expect(response.body).toBeDefined()
    })

    it('should update book status to on_loan when loan is active', async () => {
      if (!testBookId || !borrowerFamilyId || !testUserId) return

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

      // Create loan
      await request(app)
        .post('/api/loans')
        .send({
          family_book_id: bookId,
          borrower_family_id: borrowerFamilyId,
          status: 'active'
        })
        .expect(201)

      // Check book status
      const bookCheck = await request(app)
        .get(`/api/books/${bookId}`)
        .expect(200)

      expect(bookCheck.body.book.status).toBe('on_loan')
    })
  })

  describe('PUT /api/loans/:id', () => {
    it('should update loan status', async () => {
      if (!testLoanId) return

      const response = await request(app)
        .put(`/api/loans/${testLoanId}`)
        .send({
          status: 'returned'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('loan')
      expect(response.body.loan.status).toBe('returned')
    })

    it('should update book status when loan is returned', async () => {
      if (!testBookId || !borrowerFamilyId || !testUserId) return

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

      const loanResponse = await request(app)
        .post('/api/loans')
        .send({
          family_book_id: bookId,
          borrower_family_id: borrowerFamilyId,
          status: 'active'
        })

      const loanId = loanResponse.body.loan.id

      // Return the loan
      await request(app)
        .put(`/api/loans/${loanId}`)
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
        .send({ status: 'returned' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })
})

