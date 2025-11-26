import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

const appModule = await import('../index.js')
const app = appModule.default

describe('Recommendations API Endpoint', () => {
  let testUserId = null
  let testFamilyId = null
  let otherFamilyId = null
  let testBook1Id = null
  let testBook2Id = null
  let recommendationBookId = null

  beforeAll(async () => {
    // Create test user and family
    const timestamp = Date.now()
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `rectest${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Recommendation Test User',
        phone: '1111111111',
        familyName: 'Recommendation Test Family'
      })

    testUserId = userResponse.body.user?.id
    testFamilyId = userResponse.body.family_id

    // Create another family for recommendations
    const otherUserResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `recother${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'Other User',
        phone: '2222222222',
        familyName: 'Other Family'
      })

    otherFamilyId = otherUserResponse.body.family_id

    // Create books for the test user's family
    const book1Response = await request(app)
      .post('/api/books')
      .set('x-user-id', testUserId)
      .send({
        title: 'Fiction Book 1',
        author: 'Author A',
        family_id: testFamilyId,
        genre: 'Fiction',
        age_range: 'Young Adult'
      })

    testBook1Id = book1Response.body.book?.id

    const book2Response = await request(app)
      .post('/api/books')
      .set('x-user-id', testUserId)
      .send({
        title: 'Fiction Book 2',
        author: 'Author B',
        family_id: testFamilyId,
        genre: 'Fiction',
        age_range: 'Young Adult'
      })

    testBook2Id = book2Response.body.book?.id

    // Create a book in another family for recommendations
    const recBookResponse = await request(app)
      .post('/api/books')
      .set('x-user-id', otherUserResponse.body.user.id)
      .send({
        title: 'Recommended Fiction Book',
        author: 'Author C',
        family_id: otherFamilyId,
        genre: 'Fiction',
        age_range: 'Young Adult'
      })

    recommendationBookId = recBookResponse.body.book?.id

    // Add likes and reviews to establish preferences
    if (testBook1Id) {
      await request(app)
        .post(`/api/books/${testBook1Id}/likes`)
        .send({ user_id: testUserId })
    }

    if (testBook2Id) {
      await request(app)
        .post(`/api/books/${testBook2Id}/reviews`)
        .send({
          user_id: testUserId,
          rating: 5,
          review_text: 'Great book!'
        })
    }
  })

  describe('GET /api/recommendations', () => {
    it('should return JSON error when userId is missing', async () => {
      const response = await request(app)
        .get('/api/recommendations')
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('userId is required')
    })

    it('should return recommendations array with valid userId', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('recommendations')
      expect(Array.isArray(response.body.recommendations)).toBe(true)
    })

    it('should include match_percentage in recommendations', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0]
        expect(rec).toHaveProperty('match_percentage')
        expect(typeof rec.match_percentage).toBe('number')
        expect(rec.match_percentage).toBeGreaterThanOrEqual(0)
        expect(rec.match_percentage).toBeLessThanOrEqual(100)
      }
    })

    it('should include reason in recommendations', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0]
        expect(rec).toHaveProperty('reason')
        expect(typeof rec.reason).toBe('string')
        expect(rec.reason.length).toBeGreaterThan(0)
      }
    })

    it('should exclude books from user\'s own family', async () => {
      if (!testUserId || !testBook1Id) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      // Check that none of the recommendations are from the user's family
      const hasOwnBook = response.body.recommendations.some(
        (rec) => rec.family_id === testFamilyId
      )
      expect(hasOwnBook).toBe(false)
    })

    it('should exclude already liked books', async () => {
      if (!testUserId || !testBook1Id) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      // Check that liked book is not in recommendations
      const hasLikedBook = response.body.recommendations.some(
        (rec) => rec.id === testBook1Id
      )
      expect(hasLikedBook).toBe(false)
    })

    it('should exclude already reviewed books', async () => {
      if (!testUserId || !testBook2Id) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      // Check that reviewed book is not in recommendations
      const hasReviewedBook = response.body.recommendations.some(
        (rec) => rec.id === testBook2Id
      )
      expect(hasReviewedBook).toBe(false)
    })

    it('should return maximum 12 recommendations', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      expect(response.body.recommendations.length).toBeLessThanOrEqual(12)
    })

    it('should sort recommendations by match percentage', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      const recommendations = response.body.recommendations
      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].match_percentage).toBeGreaterThanOrEqual(
            recommendations[i + 1].match_percentage
          )
        }
      }
    })

    it('should work for users with no preferences', async () => {
      // Create a new user with no likes or reviews
      const timestamp = Date.now()
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `newrec${timestamp}@example.com`,
          password: 'testpass123',
          fullName: 'New Rec User',
          phone: '3333333333',
          familyName: 'New Rec Family'
        })

      const newUserId = newUserResponse.body.user?.id
      
      // Skip test if user creation failed
      if (!newUserId) {
        expect(newUserResponse.body.user).toBeDefined()
        return
      }

      const response = await request(app)
        .get(`/api/recommendations?userId=${newUserId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('recommendations')
      expect(Array.isArray(response.body.recommendations)).toBe(true)
    })

    it('should return JSON error for invalid userId', async () => {
      const response = await request(app)
        .get('/api/recommendations?userId=invalid-id')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })

    it('should always return valid JSON even on errors', async () => {
      const response = await request(app)
        .get('/api/recommendations?userId=invalid')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      expect(response.body).toHaveProperty('error')
    })

    it('should include family information in recommendations', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0]
        expect(rec).toHaveProperty('families')
      }
    })

    it('should prefer books matching liked genres', async () => {
      if (!testUserId) return

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      // Since user liked Fiction books, recommendations should include Fiction
      if (response.body.recommendations.length > 0) {
        const hasFiction = response.body.recommendations.some(
          (rec) => rec.genre === 'Fiction'
        )
        // If there are any Fiction books available, at least one should be recommended
        expect(hasFiction || response.body.recommendations.length === 0).toBe(true)
      }
    })
  })
})

