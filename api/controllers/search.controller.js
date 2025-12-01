import { supabase } from '../db/adapter.js';
import { searchBooks } from '../services/bookSearch.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Search for books across catalog and external sources
 * @route GET /api/search-books
 */
export const searchBooksGlobal = asyncHandler(async (req, res) => {
  const { q, query, provider = 'auto', maxResults = 10, userId } = req.query;
  
  // Support both 'q' and 'query' parameters
  const searchQuery = q || query;
  
  if (!searchQuery) {
    return res.status(400).json({ 
      error: 'Missing query parameter',
      message: 'Please provide a search query using ?q=... or ?query=...'
    });
  }
  
  console.log(`Book search request: "${searchQuery}" (provider: ${provider})`);
  
  // First, search our own catalog
  const { data: catalogResults, error: catalogError } = await supabase
    .from('book_catalog')
    .select('*')
    .or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`)
    .limit(10);
  
  if (catalogError) {
    console.error('Catalog search error:', catalogError);
  }
  
  // If user ID provided, check which books they already own
  let userOwnedBookIds = new Set();
  if (userId && catalogResults?.length > 0) {
    const { data: userBooks, error: userBooksError } = await supabase
      .from('family_books')
      .select('book_catalog_id, families!inner(users!inner(id))')
      .eq('families.users.id', userId);
    
    if (!userBooksError && userBooks) {
      userOwnedBookIds = new Set(userBooks.map(b => b.book_catalog_id));
    }
  }
  
  // Transform catalog results to match external API format
  const catalogBooks = (catalogResults || []).map(book => ({
    title: book.title,
    author: book.author,
    series: book.series,
    series_number: book.series_number,
    publisher: book.publisher,
    publish_year: book.year_published,
    pages: book.pages,
    description: book.summary,
    cover_image_url: book.cover_image_url,
    isbn: book.isbn,
    genre: book.genre,
    language: 'he',
    source: 'catalog',
    catalogId: book.id,
    alreadyOwned: userOwnedBookIds.has(book.id),
    confidence: 'exact',
    confidenceScore: 100
  }));
  
  // Search external sources
  const externalResults = await searchBooks(searchQuery, { 
    provider, 
    maxResults: parseInt(maxResults) 
  });
  
  // Combine results: catalog first, then external
  const allResults = [...catalogBooks, ...externalResults];
  
  res.json({
    success: true,
    query: searchQuery,
    provider,
    count: allResults.length,
    catalogCount: catalogBooks.length,
    externalCount: externalResults.length,
    results: allResults
  });
});
