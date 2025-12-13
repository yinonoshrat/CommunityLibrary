// Supabase Edge Function for async book detection from images
// This function runs with 150s timeout (vs 60s for Vercel)
// Deploy: npx supabase functions deploy detect-books --project-ref <project-ref>

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleAuth } from "npm:google-auth-library@9.0.0";
import { generateBookDetectionPrompt, formatStructuredOCR, parseVisionResponse } from '../_shared/visionServiceUtils.js';
import { searchBookDetails } from '../_shared/bookSearch.js';

// ============================================================================
// Google Cloud Vision Logic (OCR)
// ============================================================================
async function getGoogleAccessToken(credentialsJson: string) {
  try {
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  } catch (error) {
    console.error('Error getting Google Access Token:', error);
    throw error;
  }
}

async function detectTextWithGoogleVision(imageBase64: string, credentialsJson: string) {
  console.log('Starting Google Cloud Vision OCR...');
  const token = await getGoogleAccessToken(credentialsJson);
  
  const url = 'https://vision.googleapis.com/v1/images:annotate';
  const payload = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'TEXT_DETECTION' }]
      }
    ]
  };

  // 45s timeout for OCR
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vision API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const detections = data.responses?.[0]?.textAnnotations || [];
    
    console.log(`OCR detected ${detections.length} text annotations`);
    
    // Use shared utility to parse response
    return parseVisionResponse(detections);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Google Vision OCR timed out after 45s');
    }
    throw error;
  }
}

// ============================================================================
// Gemini Vision Logic (using shared prompt)
// ============================================================================
async function detectBooksWithGemini(apiKey: string, imageBase64: string, modelName = 'gemini-2.5-flash', ocrData: any = null): Promise<any[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  // Format OCR data if available
  const structuredText = ocrData ? formatStructuredOCR(ocrData) : null;
  
  // Use the SHARED prompt logic
  const prompt = generateBookDetectionPrompt(structuredText);
  
  const payload = {
    system_instruction: {
      parts: [
        { text: "You are a Hebrew assistant. When outputting Hebrew abbreviations (Rashei Tevot), you must strictly use the Hebrew Gershayim character (״) (Unicode U+05F4) or single quotes ('). NEVER use a standard double quote (\") inside a JSON string value unless it is escaped with a backslash." }
      ]
    },
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
      ]
    }],
    generation_config: {
      response_mime_type: "application/json",
      temperature: 0.0,
    }
  };

  // 120s timeout for Gemini
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();
    
    try {
      const booksData = JSON.parse(jsonText);
      
      // Validate and clean the data
      return booksData
        .filter((book: any) => book.title && typeof book.title === 'string')
        .map((book: any) => ({
          title: book.title.trim(),
          author: book.author ? book.author.trim() : '',
          // Capture extra fields from the shared prompt if available
          series: book.series || null,
          series_number: book.series_number || null,
          genre: book.genre || null,
          age_range: book.age_range || null
        }));
    } catch (e) {
      console.error('Failed to parse Gemini response:', jsonText);
      return [];
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Gemini API timed out after 120s');
    }
    throw error;
  }
}

// ============================================================================
// Edge Function Handler
// ============================================================================
Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    // Parse request
    const body = await req.json();
    jobId = body.jobId;
    const imageData = body.imageData;
    
    if (!jobId || !imageData) {
      return new Response(JSON.stringify({ error: 'Missing jobId or imageData' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Global timeout promise (145s)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Global execution timeout (145s)')), 145000);
    });

    // Main processing logic
    const processJob = async () => {
      console.log(`[${jobId}] Processing detection job started`);
      console.log(`[${jobId}] Image size: ~${Math.round(imageData.length / 1024)}KB`);

      const timings = {
        ocr: 0,
        gemini: 0,
        enrichment: 0,
        ownership: 0,
        total: 0
      };

      // Initialize Supabase client with service role
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
      const googleCredentials = Deno.env.get('GOOGLE_CLOUD_CREDENTIALS');
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get the job to retrieve user_id
      const { data: jobData, error: jobError } = await supabase
        .from('detection_jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        console.error(`[${jobId}] Failed to get job:`, jobError);
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = jobData.user_id;
      console.log(`[${jobId}] Processing for user: ${userId}`);

      // Update job status to processing
      await supabase
        .from('detection_jobs')
        .update({ status: 'processing', progress: 10, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      // Step 1: OCR (if credentials available)
      let ocrData = null;
      if (googleCredentials) {
        try {
          console.log(`[${jobId}] Google Cloud Credentials found, running Hybrid Vision (OCR + AI)...`);
          const ocrStartTime = Date.now();
          
          await supabase
            .from('detection_jobs')
            .update({ status: 'processing', progress: 20, updated_at: new Date().toISOString() })
            .eq('id', jobId);
            
          ocrData = await detectTextWithGoogleVision(imageData, googleCredentials);
          timings.ocr = Date.now() - ocrStartTime;
          console.log(`[${jobId}] OCR completed in ${timings.ocr}ms. Found ${ocrData?.blocks?.length || 0} blocks.`);
          
          // If OCR found very little text, it might be better to ignore it to avoid confusing Gemini
          if (ocrData && (!ocrData.blocks || ocrData.blocks.length === 0)) {
            console.log(`[${jobId}] OCR returned no text blocks. Ignoring OCR data.`);
            ocrData = null;
          }
        } catch (e) {
          console.error(`[${jobId}] OCR failed, falling back to AI-only:`, e);
        }
      } else {
        console.log(`[${jobId}] No Google Cloud Credentials found, running AI-only mode`);
      }

      console.log(`[${jobId}] Detecting books with Gemini...`);
      const geminiStartTime = Date.now();

      // Detect books using Gemini (Step 2: AI Detection with optional OCR context)
      // Now using the shared logic function
      const detectedBooks = await detectBooksWithGemini(geminiApiKey, imageData, 'gemini-2.5-flash', ocrData);

      timings.gemini = Date.now() - geminiStartTime;
      console.log(`[${jobId}] Gemini detection completed in ${timings.gemini}ms`);
      console.log(`[${jobId}] Detected ${detectedBooks.length} books`);

      await supabase
        .from('detection_jobs')
        .update({ progress: 50, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      console.log(`[${jobId}] Enriching with Simania search...`);
      const enrichmentStartTime = Date.now();

      // Search for book details in parallel (Step 2: Online Enrichment)
      // Using shared searchBookDetails
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
                genre: book.genre || details.genre, // Prefer AI genre if available (from shared prompt)
                age_range: book.age_range || details.age_range, // Prefer AI age range if available
                language: details.language,
                series: book.series || details.series,
                series_number: book.series_number || details.series_number,
                confidence: 'medium' as const,
                confidenceScore: details.confidence
              };
            }
            
            // Low confidence - keep AI data only
            return { ...book, confidence: 'low' as const, confidenceScore: 0 };
          } catch (err) {
            console.error(`[${jobId}] Enrichment error for "${book.title}":`, err);
            return { ...book, confidence: 'low' as const, confidenceScore: 0 };
          }
        })
      );
      
      timings.enrichment = Date.now() - enrichmentStartTime;
      console.log(`[${jobId}] Enrichment completed in ${timings.enrichment}ms`);

      await supabase
        .from('detection_jobs')
        .update({ progress: 80, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      console.log(`[${jobId}] Checking ownership for user ${userId}...`);
      const ownershipStartTime = Date.now();

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
          console.log(`[${jobId}] User lookup warning: ${userError.message} - skipping ownership check`);
        } else if (userData?.family_id) {
          // Get all books in user's family catalog
          const { data: ownedBooks, error: ownedError } = await supabase
            .from('family_books')
            .select('book_catalog_id, book_catalog!inner(title, author, series)')
            .eq('family_id', userData.family_id);

          if (ownedError) {
            console.log(`[${jobId}] Owned books lookup warning: ${ownedError.message} - skipping ownership check`);
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

            console.log(`[${jobId}] Found ${ownedKeys.size} books in user's catalog, marked ${uniqueBooks.filter(b => b.alreadyOwned).length} as already owned`);
          }
        }
      } catch (ownershipError: any) {
        console.error(`[${jobId}] Ownership check failed: ${ownershipError.message} - continuing without ownership data`);
        // Continue without ownership data - all books will have alreadyOwned: false
      }
      
      timings.ownership = Date.now() - ownershipStartTime;
      console.log(`[${jobId}] Ownership check completed in ${timings.ownership}ms`);

      timings.total = Date.now() - startTime;
      console.log(`[${jobId}] Job completed successfully in ${timings.total}ms. Total unique books: ${uniqueBooks.length}`);
      console.log(`[${jobId}] TIMING SUMMARY:`, JSON.stringify(timings));

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
    };

    // Race the main process against the global timeout
    return await Promise.race([
      processJob(),
      timeoutPromise
    ]) as Response;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${jobId || 'unknown'}] Edge function error after ${duration}ms:`, error);
    if (error.stack) {
      console.error(error.stack);
    }
    
    // Try to update job status to failed
    if (jobId) {
      try {
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
          
        console.log(`[${jobId}] Job status updated to failed`);
      } catch (e) {
        console.error(`[${jobId}] Failed to update job status to failed:`, e);
      }
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      jobId 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
