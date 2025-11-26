import { initializeSharedTestData } from './setup/testData.js'

// Global setup that runs once before all tests
export async function setup() {
  console.log('\n🔧 Initializing shared test data...\n')
  
  // Import the app
  const appModule = await import('../index.js')
  const app = appModule.default
  
  // Create shared test user and family
  await initializeSharedTestData(app)
  
  console.log('✓ Shared test data ready\n')
}

export async function teardown() {
  // Optional: cleanup if needed
  console.log('\n✓ Test cleanup complete\n')
}
