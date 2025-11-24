// Local development server - imports the same Express app used in Vercel
import app from '../api/index.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`)
})
