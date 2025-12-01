import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getSharedTestData } from './setup/testData.js'

const appModule = await import('../index.js')
const app = appModule.default

// Helper to ensure test data exists
const requireTestData = (data, message) => {
  if (!data) {
    throw new Error(`Test setup failed: ${message}`)
  }
}

describe('Families API Endpoints', () => {
  let testFamilyId = null
  let testUserId = null
  let authToken = null

  beforeAll(async () => {
    // Use shared test user and family
    const sharedData = getSharedTestData()
    testFamilyId = sharedData.familyId
    testUserId = sharedData.userId
  })

  describe('GET /api/families', () => {
    it('should return 200 and array of families', async () => {
      const response = await request(app)
        .get('/api/families')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('families')
      expect(Array.isArray(response.body.families)).toBe(true)
    })

    it('should include members in family objects', async () => {
      const response = await request(app)
        .get('/api/families')
        .expect(200)

      if (response.body.families.length > 0) {
        const family = response.body.families[0]
        expect(family).toHaveProperty('members')
        expect(Array.isArray(family.members)).toBe(true)
      }
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .get('/api/families')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('GET /api/families/:id', () => {
    it('should return family by ID', async () => {
      requireTestData(testFamilyId, 'testFamilyId is required')

      const response = await request(app)
        .get(`/api/families/${testFamilyId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('family')
      expect(response.body.family).toHaveProperty('id', testFamilyId)
    })

    it('should return JSON error for non-existent family', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .get(`/api/families/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })

    it('should return JSON error for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/families/invalid-uuid')
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/families', () => {
    it('should create new family with valid data', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/families')
        .set('x-user-id', testUserId)
        .send({
          name: `New Family ${timestamp}`,
          phone: '1111111111',
          whatsapp: '1111111111',
          email: `newfamily${timestamp}@example.com`
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('family')
      expect(response.body.family).toHaveProperty('id')
      expect(response.body.family.name).toContain('New Family')

      // Cleanup created family
      await request(app).delete(`/api/families/${response.body.family.id}`)
    })

    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/families')
        .set('x-user-id', testUserId)
        .send({
          phone: '2222222222'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle optional fields correctly', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/families')
        .set('x-user-id', testUserId)
        .send({
          name: `Minimal Family ${timestamp}`,
          email: `minimal${timestamp}@example.com`
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('family')

      // Cleanup created family
      await request(app).delete(`/api/families/${response.body.family.id}`)
    })
  })

  describe('PUT /api/families/:id', () => {
    it('should update family with valid data', async () => {
      requireTestData(testFamilyId, 'testFamilyId is required')

      const response = await request(app)
        .put(`/api/families/${testFamilyId}`)
        .set('x-user-id', testUserId)
        .send({
          phone: '9999999999'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('family')
      expect(response.body.family.phone).toBe('9999999999')
    })

    it('should return JSON error for non-existent family', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .put(`/api/families/${fakeId}`)
        .set('x-user-id', testUserId)
        .send({ phone: '8888888888' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/families/:id/members', () => {
    it('should return family members', async () => {
      requireTestData(testFamilyId, 'testFamilyId is required')

      const response = await request(app)
        .get(`/api/families/${testFamilyId}/members`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('members')
      expect(Array.isArray(response.body.members)).toBe(true)
    })

    it('should return JSON error for invalid family ID', async () => {
      const response = await request(app)
        .get('/api/families/invalid/members')
        .expect('Content-Type', /json/)
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/families/:id', () => {
    it('should delete family', async () => {
      // Create a family to delete
      const timestamp = Date.now()
      const createResponse = await request(app)
        .post('/api/families')
        .set('x-user-id', testUserId)
        .send({
          name: `Delete Me ${timestamp}`,
          email: `delete${timestamp}@example.com`
        })
        .expect(201)

      const familyId = createResponse.body.family.id

      const response = await request(app)
        .delete(`/api/families/${familyId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('deleted')
    })

    it('should return JSON error for non-existent family', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .delete(`/api/families/${fakeId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })
})

