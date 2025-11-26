import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Load from parent directory where .env.development.local exists
  const env = loadEnv(mode, process.cwd() + '/..', '')
  
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || 
        env.SUPABASE_URL || 
        env.NEXT_PUBLIC_SUPABASE_URL || 
        ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || 
        env.SUPABASE_ANON_KEY || 
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        ''
      ),
    }
  }
})
