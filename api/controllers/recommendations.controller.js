import { supabase } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Get personalized book recommendations for a user
 * @route GET /api/recommendations
 */
export const getRecommendations = asyncHandler(async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Get user's liked books with catalog info
  const { data: likesData, error: likesError } = await supabase
    .from('likes')
    .select('book_catalog_id')
    .eq('user_id', userId);

  if (likesError) throw likesError;

  // Get catalog info for liked books
  const likedCatalogIds = (likesData || []).map(l => l.book_catalog_id).filter(Boolean);
  let likedBooks = [];
  if (likedCatalogIds.length > 0) {
    const { data: catalogData } = await supabase
      .from('book_catalog')
      .select('id, genre, age_range, author')
      .in('id', likedCatalogIds);
    likedBooks = catalogData || [];
  }

  // Get user's high-rated reviews with catalog info
  const { data: reviewsData, error: reviewsError } = await supabase
    .from('reviews')
    .select('book_catalog_id, rating')
    .eq('user_id', userId)
    .gte('rating', 4);

  if (reviewsError) throw reviewsError;

  // Get catalog info for reviewed books
  const reviewedCatalogIds = (reviewsData || []).map(r => r.book_catalog_id).filter(Boolean);
  let highRatedBooks = [];
  if (reviewedCatalogIds.length > 0) {
    const { data: catalogData } = await supabase
      .from('book_catalog')
      .select('id, genre, age_range, author')
      .in('id', reviewedCatalogIds);
    highRatedBooks = catalogData || [];
  }

  // Extract preferred genres and age levels
  const preferredGenres = new Map();
  const preferredAgeLevels = new Map();

  [...likedBooks, ...highRatedBooks].forEach(book => {
    if (!book) return;
    
    if (book.genre) {
      preferredGenres.set(book.genre, (preferredGenres.get(book.genre) || 0) + 1);
    }
    if (book.age_range) {
      preferredAgeLevels.set(book.age_range, (preferredAgeLevels.get(book.age_range) || 0) + 1);
    }
  });

  // Get user's family books (to exclude)
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .single();

  const familyId = userData?.family_id;

  // Get all book catalog IDs user has interacted with (to exclude from recommendations)
  const interactedBookCatalogIds = new Set([
    ...likedCatalogIds,
    ...reviewedCatalogIds
  ]);

  // Build recommendation query - use family_books table
  let query = supabase
    .from('family_books')
    .select(`
      *,
      book_catalog!book_catalog_id(
        id,
        title,
        title_hebrew,
        author,
        author_hebrew,
        genre,
        age_level,
        cover_image_url,
        series,
        series_number
      ),
      families:family_id (
        id,
        name,
        phone,
        whatsapp
      )
    `);

  // Exclude user's own family
  if (familyId) {
    query = query.neq('family_id', familyId);
  }

  const { data: recommendations, error: recsError } = await query.limit(50);

  if (recsError) throw recsError;

  // Filter out books user has already interacted with (by catalog ID)
  let filteredRecs = (recommendations || []).filter(
    book => !interactedBookCatalogIds.has(book.book_catalog_id)
  );

  // Filter by preferred genres if we have any
  if (preferredGenres.size > 0) {
    const topGenres = Array.from(preferredGenres.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);
    
    filteredRecs = filteredRecs.filter(
      book => book.book_catalog && topGenres.includes(book.book_catalog.genre)
    );
  }

  // Calculate match scores and reasons
  const scoredRecs = filteredRecs.map(book => {
    let score = 0;
    let reasons = [];
    const catalog = book.book_catalog || {};

    // Genre match (0-40 points)
    if (catalog.genre && preferredGenres.has(catalog.genre)) {
      score += 40;
      reasons.push(`אהבת ספרי ${catalog.genre}`);
    }

    // Age level match (0-20 points)
    if (catalog.age_level && preferredAgeLevels.has(catalog.age_level)) {
      score += 20;
    }

    // Same author as liked books (0-20 points)
    const likedAuthors = [...likedBooks, ...highRatedBooks]
      .map(book => book?.author)
      .filter(Boolean);
    
    if (catalog.author && likedAuthors.includes(catalog.author)) {
      score += 20;
      reasons.push(`אהבת ספרים של ${catalog.author}`);
    }

    // Random factor (0-20 points) for diversity
    score += Math.random() * 20;

    return {
      id: book.id,
      family_book_id: book.id,
      book_catalog_id: book.book_catalog_id,
      status: book.status,
      families: book.families,
      // Flatten book_catalog fields to top level
      title: catalog.title,
      title_hebrew: catalog.title_hebrew,
      author: catalog.author,
      author_hebrew: catalog.author_hebrew,
      genre: catalog.genre,
      age_range: catalog.age_level,
      cover_image_url: catalog.cover_image_url,
      series: catalog.series,
      series_number: catalog.series_number,
      match_percentage: Math.min(100, Math.round(score)),
      reason: reasons[0] || 'מתאים לטעם שלך'
    };
  });

  // Sort by score and take top 12
  const topRecs = scoredRecs
    .sort((a, b) => b.match_percentage - a.match_percentage)
    .slice(0, 12);

  res.json({ recommendations: topRecs });
});
