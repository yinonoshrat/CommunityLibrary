// Vercel serverless function entry point
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import GeminiVisionService from './services/geminiVision.js';
import OpenAIVisionService from './services/openaiVision.js';
import HybridVisionService from './services/hybridVision.js';
import { searchBookDetails, searchBooks } from './services/bookSearch.js';
import booksRouter from './routes/books.routes.js';
import authRouter from './routes/auth.routes.js';
import familiesRouter from './routes/families.routes.js';
import usersRouter from './routes/users.routes.js';
import loansRouter from './routes/loans.routes.js';
import genreMappingsRouter from './routes/genreMappings.routes.js';
import systemRouter from './routes/system.routes.js';
import searchRouter from './routes/search.routes.js';
import reviewsRouter from './routes/reviews.routes.js';
import recommendationsRouter from './routes/recommendations.routes.js';
import { setAiVisionService } from './controllers/books.controller.js';
import { extractUserFromToken } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

const app = express();

// Environment detection
const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
const dbUrl = process.env.SUPABASE_URL || process.env.POSTGRES_URL || '';
const dbIdentifier = dbUrl.includes('supabase.co') 
  ? dbUrl.split('//')[1]?.split('.')[0] || 'unknown'
  : 'unknown';

console.log('='.repeat(60));
console.log(`🚀 API starting in ${environment.toUpperCase()} environment`);
console.log(`📊 Database: ${dbIdentifier}`);
console.log('='.repeat(60));

// Initialize AI Vision Service (priority order: Hybrid > OpenAI > Gemini)
let aiVisionService = null;
let serviceName = 'none';
try {
  // Hybrid (Google Cloud Vision OCR + Gemini) - Best accuracy
  if ((process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS) && process.env.GEMINI_API_KEY) {
    aiVisionService = new HybridVisionService();
    serviceName = 'Hybrid (Google Cloud OCR + Gemini)';
  }
  // OpenAI GPT-4o-mini - Fast and accurate
  else if (process.env.OPENAI_API_KEY) {
    aiVisionService = new OpenAIVisionService();
    serviceName = 'OpenAI (GPT-4o-mini)';
  }
  // Gemini only - Fallback
  else if (process.env.GEMINI_API_KEY) {
    aiVisionService = new GeminiVisionService();
    serviceName = 'Gemini (2.5 Flash)';
  }
  
  if (aiVisionService) {
    console.log(`✓ AI Vision Service initialized: ${serviceName}`);
    // Inject AI service into books controller
    setAiVisionService(aiVisionService);
  } else {
    console.warn('⚠ No AI API keys found - bulk upload features will be disabled');
    console.warn('  Set one of: OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS');
  }
} catch (error) {
  console.error('✗ Failed to initialize AI Vision Service:', error.message);
  console.error('  Service attempted:', serviceName);
}

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      // Pass error as null to avoid HTML error page, check in route handler
      cb(null, false);
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to extract user context (supports Bearer token + x-user-id for tests)
app.use(extractUserFromToken);

// ==================== ROUTE MODULES ====================
// Mount books router (handles all /api/books routes)
app.use('/api/books', booksRouter);

// Mount auth router (handles all /api/auth routes)
app.use('/api/auth', authRouter);

// Mount families router (handles all /api/families routes)
app.use('/api/families', familiesRouter);

// Mount users router (handles all /api/users routes)
app.use('/api/users', usersRouter);

// Mount loans router (handles all /api/loans routes)
app.use('/api/loans', loansRouter);

// Mount genre mappings router (handles all /api/genre-mappings routes)
app.use('/api/genre-mappings', genreMappingsRouter);

// Mount reviews router
app.use('/api/reviews', reviewsRouter);

// Mount recommendations router (handles /api/recommendations)
app.use('/api/recommendations', recommendationsRouter);

// Mount system router (handles /api/health)
app.use('/api', systemRouter);

// Mount search router (handles /api/search-books)
app.use('/api', searchRouter);

// ==================== GLOBAL ERROR HANDLER ====================
app.use(errorHandler);

export default app;
