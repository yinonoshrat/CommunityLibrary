import { asyncHandler } from '../middleware/errorHandler.middleware.js';

const GENRES = [
  'רומן',
  'מתח',
  'מדע בדיוני',
  'פנטזיה',
  'ביוגרפיה',
  'היסטוריה',
  'מדע',
  'ילדים',
  'נוער',
  'עיון',
  'שירה',
  'אחר',
];

const AGE_LEVELS = [
  '0-3',
  '4-6',
  '7-9',
  '10-12',
  '13-15',
  '16-18',
  'מבוגרים',
  'כל הגילאים',
];

/**
 * Enrich books catalog with missing genre and age_range using Gemini AI
 * @route POST /api/books/enrich-catalog
 */
export const enrichCatalog = asyncHandler(async (req, res) => {
  console.log('[enrichCatalog] Starting catalog enrichment...');

  // Only admins should be able to run this
  if (!req.user || !req.user.is_family_admin) {
    return res.status(403).json({ error: 'Only admins can enrich the catalog' });
  }

  const { supabase } = await import('../db/adapter.js');

  // Get all books without genre or age_range
  const { data: booksToEnrich, error: fetchError } = await supabase
    .from('book_catalog')
    .select('id, title, author, series, series_number, genre, age_level')
    .or('genre.is.null,age_level.is.null');

  if (fetchError) {
    console.error('[enrichCatalog] Error fetching books:', fetchError);
    return res.status(500).json({ error: 'Failed to fetch books' });
  }

  if (!booksToEnrich || booksToEnrich.length === 0) {
    console.log('[enrichCatalog] No books need enrichment');
    return res.json({ 
      success: true, 
      message: 'All books already have genre and age range',
      enriched: 0 
    });
  }

  console.log(`[enrichCatalog] Found ${booksToEnrich.length} books to enrich`);

  // Prepare books for Gemini (limit to reasonable batch size)
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < booksToEnrich.length; i += batchSize) {
    batches.push(booksToEnrich.slice(i, i + batchSize));
  }

  console.log(`[enrichCatalog] Processing ${batches.length} batches`);

  let totalEnriched = 0;
  let totalFailed = 0;

  // Import Gemini service
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error('[enrichCatalog] GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[enrichCatalog] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} books)`);

    // Create prompt for Gemini
    const prompt = `You are a book classification expert. I will provide you with a list of books (title and author), and you need to classify each one with:
1. A genre from this list: ${GENRES.join(', ')}
2. An age range from this list: ${AGE_LEVELS.join(', ')}

For each book, return ONLY a JSON array with this exact structure:
[
  {
    "id": "book_id_here",
    "genre": "genre_from_list",
    "age_level": "age_from_list"
  }
]

Rules:
- Use ONLY genres and age levels from the provided lists
- If you're unsure, use "אחר" for genre and "כל הגילאים" for age
- Return ONLY the JSON array, no other text
- Keep the exact book IDs I provide

Books to classify:
${batch.map(b => {
  let bookInfo = `ID: ${b.id}, Title: ${b.title || 'Unknown'}, Author: ${b.author || 'Unknown'}`;
  if (b.series) {
    bookInfo += `, Series: ${b.series}`;
    if (b.series_number) {
      bookInfo += ` #${b.series_number}`;
    }
  }
  return bookInfo;
}).join('\n')}`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      console.log('[enrichCatalog] Gemini response received');

      // Parse JSON response
      let classifications;
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        classifications = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[enrichCatalog] Failed to parse Gemini response:', parseError);
        console.error('[enrichCatalog] Response text:', text);
        totalFailed += batch.length;
        continue;
      }

      // Update each book in the database
      for (const classification of classifications) {
        try {
          const { error: updateError } = await supabase
            .from('book_catalog')
            .update({
              genre: classification.genre,
              age_level: classification.age_level,
              updated_at: new Date().toISOString()
            })
            .eq('id', classification.id);

          if (updateError) {
            console.error(`[enrichCatalog] Failed to update book ${classification.id}:`, updateError);
            totalFailed++;
          } else {
            console.log(`[enrichCatalog] Updated book ${classification.id}: ${classification.genre}, ${classification.age_level}`);
            totalEnriched++;
          }
        } catch (err) {
          console.error(`[enrichCatalog] Error updating book ${classification.id}:`, err);
          totalFailed++;
        }
      }

      // Small delay between batches to avoid rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`[enrichCatalog] Error processing batch ${batchIndex + 1}:`, error);
      totalFailed += batch.length;
    }
  }

  console.log(`[enrichCatalog] Enrichment complete. Enriched: ${totalEnriched}, Failed: ${totalFailed}`);

  res.json({
    success: true,
    enriched: totalEnriched,
    failed: totalFailed,
    total: booksToEnrich.length
  });
});
