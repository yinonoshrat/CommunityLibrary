import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index.js'

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toBe('Community Library API is running')
    })
  })

  describe('GET /api/books', () => {
    it('should return 200 and empty books array', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('books')
      expect(Array.isArray(response.body.books)).toBe(true)
      expect(response.body.books).toHaveLength(0)
    })
  })
})
