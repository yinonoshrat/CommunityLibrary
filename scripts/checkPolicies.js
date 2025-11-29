import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.development.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=\"?(.*)\"?$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/\r$/, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const query = "SELECT polname, pg_get_expr(polqual, polrelid) AS policy, pg_get_expr(with_check, polrelid) AS with_check FROM pg_policies WHERE tablename='families'"

const run = async () => {
  const { data, error } = await supabase.rpc('exec_sql', { query, params: null })
  if (error) {
    console.error('Error fetching policies:', error)
  } else {
    console.table(data)
  }
  process.exit(0)
}

run()
