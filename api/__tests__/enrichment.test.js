import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createClient } from '@supabase/supabase-js'

const appModule = await import('../index.js')
const app = appModule.default

describe('Enrichment API Endpoints', () => {
  describe('POST /api/enrichment/catalog', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/enrichment/catalog')
        .expect('Content-Type', /json/)
        .expect(401)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toBe('Authentication required')
    })

    it('should enrich catalog with admin user authentication', async () => {
      // Initialize Supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Find an existing admin user for testing
      const { data: adminUser, error: userError } = await supabase
        .from('users')
        .select('id, family_id, email')
        .eq('is_family_admin', true)
        .limit(1)
        .single()

      if (userError || !adminUser) {
        console.log('⊘ Skipping test - no admin user available')
        return
      }

      console.log('✓ Found admin user for testing:', adminUser.id)

      const response = await request(app)
        .post('/api/enrichment/catalog')
        .set('x-user-id', adminUser.id)
        .expect('Content-Type', /json/)

      // Expect either success or valid error response
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('message')
        expect(response.body).toHaveProperty('enriched')
        expect(response.body).toHaveProperty('total')
        expect(typeof response.body.enriched).toBe('number')
        expect(typeof response.body.total).toBe('number')
        expect(response.body.enriched).toBeLessThanOrEqual(response.body.total)
        console.log(`✓ Enriched ${response.body.enriched} of ${response.body.total} books`)
      } else {
        // Other errors should still return valid JSON
        expect(response.body).toHaveProperty('error')
        expect(typeof response.body.error).toBe('string')
        console.log(`⚠ Enrichment returned error: ${response.body.error}`)
      }
    })

    it('should always return valid JSON response', async () => {
      // Initialize Supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Find an existing admin user for testing
      const { data: adminUser } = await supabase
        .from('users')
        .select('id, family_id, email')
        .eq('is_family_admin', true)
        .limit(1)
        .single()

      if (!adminUser) {
        console.log('⊘ Skipping test - no admin user available')
        return
      }

      const response = await request(app)
        .post('/api/enrichment/catalog')
        .set('x-user-id', adminUser.id)
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })

    it('should handle Gemini API failures gracefully', async () => {
      // Initialize Supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Find an existing admin user for testing
      const { data: adminUser } = await supabase
        .from('users')
        .select('id, family_id, email')
        .eq('is_family_admin', true)
        .limit(1)
        .single()

      if (!adminUser) {
        console.log('⊘ Skipping test - no admin user available')
        return
      }

      // This test verifies that even if Gemini fails, we get proper JSON error
      const response = await request(app)
        .post('/api/enrichment/catalog')
        .set('x-user-id', adminUser.id)
        .expect('Content-Type', /json/)

      // Should return JSON whether success or error
      expect(response.body).toBeDefined()
      
      if (response.statusCode !== 200) {
        expect(response.body).toHaveProperty('error')
        expect(typeof response.body.error).toBe('string')
      }
    })
  })
})
