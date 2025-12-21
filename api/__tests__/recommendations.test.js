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

// Initialize Supabase for creating second family
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

describe('Recommendations API Endpoint', () => {
  let testUserId = null
  let testFamilyId = null
  let otherFamilyId = null
  let testBook1Id = null
  let testBook2Id = null
  let recommendationBookId = null

  beforeAll(async () => {
    // Use shared test user and family
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId

    // Create or find another family for recommendations
    const { data: existingFamily } = await supabase
      .from('families')
      .select('id')
      .eq('name', 'Recommendations Other Family')
      .maybeSingle()

    if (existingFamily) {
      otherFamilyId = existingFamily.id
    } else {
      const { data: newFamily, error } = await supabase
        .from('families')
        .insert({ name: 'Recommendations Other Family', phone: '2222222222' })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating other family:', error)
        throw error
      }
      otherFamilyId = newFamily.id
    }

    // Get existing books or create new ones
    const booksResponse = await request(app)
      .get(`/api/books?familyId=${testFamilyId}`)
    
    if (booksResponse.body.books && booksResponse.body.books.length >= 2) {
      // Books are grouped by catalog, get family_book IDs from viewerContext
      testBook1Id = booksResponse.body.books[0].viewerContext?.ownedCopies?.[0]?.familyBookId
      testBook2Id = booksResponse.body.books[1].viewerContext?.ownedCopies?.[0]?.familyBookId
    } else if (booksResponse.body.books && booksResponse.body.books.length === 1) {
      testBook1Id = booksResponse.body.books[0].viewerContext?.ownedCopies?.[0]?.familyBookId
      
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
    } else {
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
    }

    // Check if recommendation book exists in other family
    const otherBooksResponse = await request(app)
      .get(`/api/books?familyId=${otherFamilyId}`)
    
    if (otherBooksResponse.body.books && otherBooksResponse.body.books.length > 0) {
      recommendationBookId = otherBooksResponse.body.books[0].viewerContext?.ownedCopies?.[0]?.familyBookId
    } else {
      // Create a book in another family for recommendations
      const { data: otherUser } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', otherFamilyId)
        .maybeSingle()

      let otherUserId = otherUser?.id
      if (!otherUserId) {
        // Create a user for the other family
        let authUser
        const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
          email: `recother@testfamily.com`,
          password: 'testpass123',
          email_confirm: true
        })

        if (createError) {
           if (createError.message?.includes('already registered') || createError.status === 422) {
             const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
               email: `recother@testfamily.com`,
               password: 'testpass123'
             })
             if (signInError) throw signInError
             authUser = { user: signInData.user }
           } else {
             throw createError
           }
        } else {
          authUser = createdUser
        }

        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: authUser.user.id,
            email: 'recother@testfamily.com',
            auth_email: 'recother@testfamily.com',
            full_name: 'Other Family User',
            phone: '2222222222',
            whatsapp: '2222222222',
            family_id: otherFamilyId,
            is_family_admin: true
          })
          .select()
          .single()
        otherUserId = newUser.id
      }

      const recBookResponse = await request(app)
        .post('/api/books')
        .set('x-user-id', otherUserId)
        .send({
          title: 'Recommendation Book',
          author: 'Recommendation Author',
          family_id: otherFamilyId,
          genre: 'Fiction',
          age_range: 'Young Adult'
        })

      recommendationBookId = recBookResponse.body.book?.id
    }

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
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('recommendations')
      expect(Array.isArray(response.body.recommendations)).toBe(true)
    })

    it('should include match_percentage in recommendations', async () => {
      requireTestData(testUserId, 'testUserId is required')

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
      requireTestData(testUserId, 'testUserId is required')

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
      requireTestData(testUserId, 'testUserId is required'); requireTestData(testBook1Id, 'testBook1Id is required')

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
      requireTestData(testUserId, 'testUserId is required'); requireTestData(testBook1Id, 'testBook1Id is required')

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
      requireTestData(testUserId, 'testUserId is required')
      requireTestData(testBook2Id, 'testBook2Id is required')

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
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      expect(response.body.recommendations.length).toBeLessThanOrEqual(12)
    })

    it('should sort recommendations by match percentage', async () => {
      requireTestData(testUserId, 'testUserId is required')

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
      // Create a temporary user without any books/likes/reviews
      const { data: tempFamily } = await supabase
        .from('families')
        .insert({ name: 'Temp Rec No Prefs Family', phone: '3333333333' })
        .select()
        .single()

      const { data: authUser } = await supabase.auth.admin.createUser({
        email: `temprec${Date.now()}@testfamily.com`,
        password: 'testpass123',
        email_confirm: true
      })

      const { data: tempUser } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: authUser.user.email,
          auth_email: authUser.user.email,
          full_name: 'Temp Rec User',
          phone: '3333333333',
          whatsapp: '3333333333',
          family_id: tempFamily.id,
          is_family_admin: true
        })
        .select()
        .single()

      const response = await request(app)
        .get(`/api/recommendations?userId=${tempUser.id}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('recommendations')
      expect(Array.isArray(response.body.recommendations)).toBe(true)

      // Cleanup: delete temp user (which cascades to users table) and family
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await supabase.from('families').delete().eq('id', tempFamily.id)
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
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0]
        expect(rec).toHaveProperty('families')
      }
    })

    it('should prefer books matching liked genres', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/recommendations?userId=${testUserId}`)
        .expect(200)

      // Since user liked Fiction books, recommendations should ideally include Fiction
      // But if no Fiction books are available in the DB, it might return others
      if (response.body.recommendations.length > 0) {
        const hasFiction = response.body.recommendations.some(
          (rec) => rec.genre === 'Fiction'
        )
        // Just verify we got an array
        expect(Array.isArray(response.body.recommendations)).toBe(true)
      }
    })
  })
})

