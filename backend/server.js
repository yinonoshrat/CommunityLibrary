// Local development server - imports the same Express app used in Vercel
// Load environment variables FIRST before any other imports
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Add global error handlers to catch crashes
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: UNHANDLED REJECTION:', reason);
});

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from parent directory BEFORE importing app
config({ path: resolve(__dirname, '../.env.development.local') })

// Now import the app AFTER env vars are loaded
const { default: app } = await import('../api/index.js')

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`)
})
