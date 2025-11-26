import { describe, it, expect } from 'vitest'
import request from 'supertest'

const appModule = await import('../index.js')
const app = appModule.default

describe('Genre Mappings API Endpoints', () => {
  describe('GET /api/genre-mappings', () => {
    it('should return 200 and array of mappings', async () => {
      const response = await request(app)
        .get('/api/genre-mappings')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('mappings')
      expect(Array.isArray(response.body.mappings)).toBe(true)
    })

    it('should return mappings sorted by usage_count', async () => {
      const response = await request(app)
        .get('/api/genre-mappings')
        .expect(200)

      const mappings = response.body.mappings
      if (mappings.length > 1) {
        for (let i = 0; i < mappings.length - 1; i++) {
          expect(mappings[i].usage_count).toBeGreaterThanOrEqual(
            mappings[i + 1].usage_count
          )
        }
      }
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .get('/api/genre-mappings')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })

    it('should include all required fields in mappings', async () => {
      const response = await request(app)
        .get('/api/genre-mappings')
        .expect(200)

      if (response.body.mappings.length > 0) {
        const mapping = response.body.mappings[0]
        expect(mapping).toHaveProperty('original_category')
        expect(mapping).toHaveProperty('mapped_genre')
        expect(mapping).toHaveProperty('usage_count')
      }
    })
  })

  describe('POST /api/genre-mappings', () => {
    it('should return JSON error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: 'Test Category'
          // Missing mapped_genre
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Missing required fields')
    })

    it('should return JSON error when original_category is missing', async () => {
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({
          mapped_genre: 'Fiction'
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should create new genre mapping', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: `Test Category ${timestamp}`,
          mapped_genre: 'Fiction'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('mapping')
      expect(response.body.mapping).toHaveProperty('original_category')
      expect(response.body.mapping).toHaveProperty('mapped_genre')
      expect(response.body.mapping).toHaveProperty('usage_count')
      expect(response.body.mapping.usage_count).toBe(1)
    })

    it('should increment usage_count for existing mapping', async () => {
      const timestamp = Date.now()
      const mapping = {
        original_category: `Increment Test ${timestamp}`,
        mapped_genre: 'Non-Fiction'
      }

      // First creation
      const firstResponse = await request(app)
        .post('/api/genre-mappings')
        .send(mapping)
        .expect(200)

      expect(firstResponse.body.mapping.usage_count).toBe(1)

      // Second creation (should increment)
      const secondResponse = await request(app)
        .post('/api/genre-mappings')
        .send(mapping)
        .expect(200)

      expect(secondResponse.body.mapping.usage_count).toBe(2)
    })

    it('should update timestamp on increment', async () => {
      const timestamp = Date.now()
      const mapping = {
        original_category: `Timestamp Test ${timestamp}`,
        mapped_genre: 'Mystery'
      }

      // First creation
      const firstResponse = await request(app)
        .post('/api/genre-mappings')
        .send(mapping)
        .expect(200)

      const firstTimestamp = firstResponse.body.mapping.updated_at

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second creation
      const secondResponse = await request(app)
        .post('/api/genre-mappings')
        .send(mapping)
        .expect(200)

      const secondTimestamp = secondResponse.body.mapping.updated_at

      // Updated timestamp should be different
      expect(secondTimestamp).not.toBe(firstTimestamp)
    })

    it('should handle different original categories mapping to same genre', async () => {
      const timestamp = Date.now()
      
      const mapping1 = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: `SciFi ${timestamp}`,
          mapped_genre: 'Science Fiction'
        })
        .expect(200)

      const mapping2 = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: `Sci-Fi ${timestamp}`,
          mapped_genre: 'Science Fiction'
        })
        .expect(200)

      expect(mapping1.body.mapping.mapped_genre).toBe('Science Fiction')
      expect(mapping2.body.mapping.mapped_genre).toBe('Science Fiction')
      expect(mapping1.body.mapping.id).not.toBe(mapping2.body.mapping.id)
    })

    it('should always return valid JSON even on errors', async () => {
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
      expect(response.body).toHaveProperty('error')
    })

    it('should handle very long category names', async () => {
      const timestamp = Date.now()
      const longCategory = 'A'.repeat(500)
      
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: `${longCategory} ${timestamp}`,
          mapped_genre: 'Fiction'
        })
        .expect('Content-Type', /json/)

      // Should either succeed or return proper error JSON
      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })

    it('should preserve case in category and genre names', async () => {
      const timestamp = Date.now()
      const response = await request(app)
        .post('/api/genre-mappings')
        .send({
          original_category: `CamelCase Category ${timestamp}`,
          mapped_genre: 'Science-Fiction'
        })
        .expect(200)

      expect(response.body.mapping.original_category).toContain('CamelCase')
      expect(response.body.mapping.mapped_genre).toBe('Science-Fiction')
    })
  })
})

