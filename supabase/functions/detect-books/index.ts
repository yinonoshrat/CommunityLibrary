// Supabase Edge Function for async book detection from images
// This function runs with 150s timeout (vs 60s for Vercel)
// Deploy: npx supabase functions deploy detect-books --project-ref <project-ref>

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateSimpleBookDetectionPrompt, parseJsonResponse } from './visionServiceUtils.ts';

// ============================================================================
// Gemini Vision Service (shared logic with backend)
// ============================================================================
class GeminiVisionService {
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async detectBooksFromImage(imageBase64: string): Promise<any[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    
    // Use the shared prompt generation function
    const prompt = generateSimpleBookDetectionPrompt();
    
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Use the shared JSON parser
    return parseJsonResponse(text);
  }
}

// ============================================================================
// Book Search Service (shared with backend - Simania API)
// ============================================================================
const SIMANIA_API = 'https://simania.co.il/api/search';

async function searchBookDetails(title: string, author?: string) {
  try {
    const query = author ? `${title} ${author}` : title;
    const url = `${SIMANIA_API}?query=${encodeURIComponent(query)}&page=1`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.success || !data.data?.books || data.data.books.length === 0) {
      return null;
    }
    
    const book = data.data.books[0]; // Best match from Simania
    
    // Process cover image URL
    let coverImageUrl = null;
    if (book.COVER) {
      coverImageUrl = book.COVER;
    } else if (book.imageLink) {
      const imagePath = book.imageLink;
      if (imagePath.includes('loadJpg.php')) {
        const match = imagePath.match(/[?&]imageName=([^&]+)/);
        coverImageUrl = match ? `https://simania.co.il/bookimages/${match[1]}` : `https://simania.co.il${imagePath}`;
      } else {
        coverImageUrl = `https://simania.co.il${imagePath}`;
      }
    }
    
    return {
      title: book.NAME || title,
      author: book.AUTHOR || author || '',
      publisher: book.PUBLISHER || null,
      publish_year: book.YEAR || book.bookYear || null,
      pages: book.PAGES || null,
      description: book.DESCRIPTION || null,
      cover_image_url: coverImageUrl,
      isbn: book.ISBN || null,
      genre: book.CATEGORY || null,
      series: book.SERIES || null,
      series_number: book.seriesNumber ? parseSeriesNumber(book.seriesNumber) : null,
      language: 'he',
      confidence: 85
    };
  } catch (error) {
    console.error(`Search error for "${title}":`, error);
    return null;
  }
}

function parseSeriesNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value).match(/\d+/);
  if (match) {
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

// ============================================================================
// Edge Function Handler
// ============================================================================
Deno.serve(async (req: Request) => {
  try {
    // Parse request
    const { jobId, imageData } = await req.json();
    
    if (!jobId || !imageData) {
      return new Response(JSON.stringify({ error: 'Missing jobId or imageData' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing detection job: ${jobId}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the job to retrieve user_id
    const { data: jobData, error: jobError } = await supabase
      .from('detection_jobs')
      .select('user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !jobData) {
      console.error(`Failed to get job ${jobId}:`, jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = jobData.user_id;
    console.log(`Processing for user: ${userId}`);

    // Update job status to processing
    await supabase
      .from('detection_jobs')
      .update({ status: 'processing', progress: 10, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`Detecting books with Gemini...`);

    // Detect books using Gemini (Step 1: AI Detection)
    const gemini = new GeminiVisionService(geminiApiKey);
    const detectedBooks = await gemini.detectBooksFromImage(imageData);

    console.log(`Detected ${detectedBooks.length} books`);

    await supabase
      .from('detection_jobs')
      .update({ progress: 50, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`Enriching with Simania search...`);

    // Search for book details in parallel (Step 2: Online Enrichment)
    const enrichedBooks = await Promise.all(
      detectedBooks.map(async (book: any) => {
        try {
          const details = await searchBookDetails(book.title, book.author);
          
          if (details && details.confidence >= 70) {
            // High confidence - use online data
            return { ...book, ...details, confidence: 'high' as const, confidenceScore: details.confidence };
          } else if (details && details.confidence >= 40) {
            // Medium confidence - merge
            return {
              title: book.title,
              author: book.author || details.author,
              publisher: details.publisher,
              publish_year: details.publish_year,
              pages: details.pages,
              description: details.description,
              cover_image_url: details.cover_image_url,
              isbn: details.isbn,
              genre: details.genre,
              language: details.language,
              series: details.series,
              series_number: details.series_number,
              confidence: 'medium' as const,
              confidenceScore: details.confidence
            };
          }
          
          // Low confidence - keep AI data only
          return { ...book, confidence: 'low' as const, confidenceScore: 0 };
        } catch (err) {
          console.error(`Enrichment error for "${book.title}":`, err);
          return { ...book, confidence: 'low' as const, confidenceScore: 0 };
        }
      })
    );

    await supabase
      .from('detection_jobs')
      .update({ progress: 80, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`Checking ownership for user ${userId}...`);

    // Deduplicate books (same logic as backend)
    const uniqueBooks: any[] = [];
    const seen = new Set<string>();
    
    for (const book of enrichedBooks) {
      const series = (book.series || '').toLowerCase().trim();
      const seriesNum = book.series_number != null ? String(book.series_number) : '';
      const key = `${book.title.toLowerCase().trim()}|${(book.author || '').toLowerCase().trim()}|${series}|${seriesNum}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        // Initialize alreadyOwned to false by default
        uniqueBooks.push({ ...book, alreadyOwned: false });
      }
    }

    // Check which books are already owned by the user
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.log(`User lookup warning: ${userError.message} - skipping ownership check`);
      } else if (userData?.family_id) {
        // Get all books in user's family catalog
        const { data: ownedBooks, error: ownedError } = await supabase
          .from('family_books')
          .select('book_catalog_id, book_catalog!inner(title, author, series)')
          .eq('family_id', userData.family_id);

        if (ownedError) {
          console.log(`Owned books lookup warning: ${ownedError.message} - skipping ownership check`);
        } else if (ownedBooks) {
          // Create a set of owned book keys for quick lookup
          const ownedKeys = new Set<string>();
          for (const owned of ownedBooks) {
            const bookData = owned.book_catalog as any;
            if (bookData) {
              const series = (bookData.series || '').toLowerCase().trim();
              const key = `${bookData.title.toLowerCase().trim()}|${(bookData.author || '').toLowerCase().trim()}|${series}`;
              ownedKeys.add(key);
            }
          }

          // Mark books as already owned
          for (const book of uniqueBooks) {
            const series = (book.series || '').toLowerCase().trim();
            const key = `${book.title.toLowerCase().trim()}|${(book.author || '').toLowerCase().trim()}|${series}`;
            book.alreadyOwned = ownedKeys.has(key);
          }

          console.log(`Found ${ownedKeys.size} books in user's catalog, marked ${uniqueBooks.filter(b => b.alreadyOwned).length} as already owned`);
        }
      }
    } catch (ownershipError) {
      console.error(`Ownership check failed: ${ownershipError.message} - continuing without ownership data`);
      // Continue without ownership data - all books will have alreadyOwned: false
    }

    await supabase
      .from('detection_jobs')
      .update({ progress: 90, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // Sort by confidence
    const sortedBooks = uniqueBooks.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const orderDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (orderDiff !== 0) return orderDiff;
      return b.confidenceScore - a.confidenceScore;
    });

    console.log(`Final result: ${sortedBooks.length} unique books`);
    console.log(`  High: ${sortedBooks.filter(b => b.confidence === 'high').length}`);
    console.log(`  Medium: ${sortedBooks.filter(b => b.confidence === 'medium').length}`);
    console.log(`  Low: ${sortedBooks.filter(b => b.confidence === 'low').length}`);

    // Update job with results
    const { error: updateError } = await supabase
      .from('detection_jobs')
      .update({
        status: 'completed',
        progress: 100,
        result: { books: sortedBooks, count: sortedBooks.length },
        image_data: null, // Clear image data after processing
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: sortedBooks.length,
      jobId 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Edge function error:', error);
    
    // Try to update job status to failed
    try {
      const body = await req.clone().json();
      const jobId = body.jobId;
      
      if (jobId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('detection_jobs')
          .update({
            status: 'failed',
            error: error.message || 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }
    } catch (e) {
      console.error('Failed to update job status:', e);
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
