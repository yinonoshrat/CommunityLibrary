import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars manually to be sure
config({ path: resolve(process.cwd(), '../.env.development.local') })

describe('Diagnostic', () => {
  it('should have environment variables', () => {
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not Set')
    expect(process.env.SUPABASE_URL).toBeDefined()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined()
  })

  it('should connect to Supabase', async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) console.error('Supabase Error:', error)
    expect(error).toBeNull()
  })
})
