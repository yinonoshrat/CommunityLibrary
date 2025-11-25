import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from parent directory
config({ path: resolve(process.cwd(), '../.env.development.local') })

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
