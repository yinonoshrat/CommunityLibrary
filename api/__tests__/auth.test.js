import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'

// Import the Express app
const appModule = await import('../index.js')
const app = appModule.default

describe('Auth API Endpoints', () => {
  // Test data - use valid email format
  const timestamp = Date.now()
  const testUser = {
    email: `test${timestamp}@test.com`,
    password: 'testpass123',
    fullName: 'Test User',
    phone: '1234567890',
    whatsapp: '1234567890',
    familyName: 'Test Family',
    familyPhone: '9876543210',
    familyWhatsapp: '9876543210'
  }

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('family_id')
      expect(response.body.user).toHaveProperty('email', testUser.email)
      expect(response.body.user).toHaveProperty('full_name', testUser.fullName)
      expect(response.body.family_id).toBeTruthy()
    })

    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Missing required fields')
    })

    it('should return JSON error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'testpass123',
          fullName: 'Test User',
          phone: '1234567890'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })

    it('should return JSON error for duplicate email', async () => {
      const uniqueEmail = `duplicate${Date.now()}@test.com`
      
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'testpass123',
          fullName: 'First User',
          phone: '1111111111'
        })
        .expect(201)

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'testpass123',
          fullName: 'Second User',
          phone: '2222222222'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })

    it('should handle registration without family data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `nofamily${Date.now()}@test.com`,
          password: 'testpass123',
          fullName: 'Solo User',
          phone: '3333333333'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('user')
      expect(response.body.family_id).toBeNull()
    })

    it('should use default values for missing optional fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `minimal${Date.now()}@test.com`,
          password: 'testpass123',
          fullName: 'Minimal User',
          phone: '4444444444',
          familyName: 'Minimal Family'
        })
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user.whatsapp).toBe('4444444444')
      expect(response.body.family_id).toBeTruthy()
    })

    it('should always return valid JSON even on server errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: null, // This will cause an error
          password: 'testpass123',
          fullName: 'Error User'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      // Must be valid JSON
      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      const email = `logintest${Date.now()}@test.com`
      const password = 'testpass123'
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          fullName: 'Login Test User',
          phone: '5555555555'
        })
        .expect(201)

      // Then login
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('session')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe(email)
    })

    it('should return JSON error for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect('Content-Type', /json/)
        .expect(401)

      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })

    it('should always return valid JSON even on errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: null,
          password: null
        })
        .expect('Content-Type', /json/)
        .expect(401)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ok')
    })
  })
})
