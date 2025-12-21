import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { getSharedTestData } from './setup/testData.js'
import { resourceManager } from './setup/resourceManager.js'
import { setAiVisionService } from '../../backend_shared_src/controllers/books.controller.js'

const appModule = await import('../index.js')
const app = appModule.default

describe('Detection API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null
  let mockAiService = null

  beforeAll(async () => {
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId

    // Mock AI Service
    mockAiService = {
      detectBooksFromImage: vi.fn().mockResolvedValue({
        books: [
          { title: 'Detected Book 1', author: 'Author 1' },
          { title: 'Detected Book 2', author: 'Author 2' }
        ],
        errorCode: null,
        canRetry: false
      })
    }

    // Inject mock service
    setAiVisionService(mockAiService)
  })

  afterAll(async () => {
    await resourceManager.cleanup()
  })

  describe('POST /api/books/detect-from-image', () => {
    it('should create a detection job and return it', async () => {
      // Create a dummy image buffer
      const imageBuffer = Buffer.from('fake-image-data')
      
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .set('x-user-id', testUserId)
        .attach('image', imageBuffer, 'test-image.jpg')
        .expect('Content-Type', /json/)
        .expect(200) // OK

      expect(response.body).toHaveProperty('jobId')
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('message')
      
      // Track job for cleanup
      resourceManager.track('detection_jobs', response.body.jobId)
    })

    it('should return 400 if no image is provided', async () => {
      const response = await request(app)
        .post('/api/books/detect-from-image')
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/books/detect-jobs', () => {
    it('should return list of detection jobs', async () => {
      const response = await request(app)
        .get('/api/books/detect-jobs')
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(200)

      // API returns array directly
      expect(Array.isArray(response.body)).toBe(true)
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id')
        expect(response.body[0]).toHaveProperty('status')
      }
    })
  })

  describe('GET /api/books/detect-job/:jobId', () => {
    it('should return job details', async () => {
      // Create a job first
      const imageBuffer = Buffer.from('fake-image-data')
      const createResponse = await request(app)
        .post('/api/books/detect-from-image')
        .set('x-user-id', testUserId)
        .attach('image', imageBuffer, 'test-image.jpg')
        .expect(200)
      
      const jobId = createResponse.body.jobId
      resourceManager.track('detection_jobs', jobId)

      const response = await request(app)
        .get(`/api/books/detect-job/${jobId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(200)

      // API might return { job: ... } or just the job object
      if (response.body.job) {
        expect(response.body.job).toHaveProperty('id', jobId)
      } else {
        expect(response.body).toHaveProperty('id', jobId)
      }
    })

    it('should return 404 for non-existent job', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .get(`/api/books/detect-job/${fakeId}`)
        .set('x-user-id', testUserId)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })
  })
})
