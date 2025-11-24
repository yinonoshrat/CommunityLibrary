// Vercel serverless function entry point
import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Community Library API is running' });
});

app.get('/api/books', (req, res) => {
  // TODO: Implement book listing
  res.json({ books: [] });
});

export default app;
