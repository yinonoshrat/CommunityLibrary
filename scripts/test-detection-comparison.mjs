import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';
import HybridVisionService from '../backend_shared_src/services/hybridVision.js';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.development.local' });

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_IMAGES_DIR = path.join(PROJECT_ROOT, 'test-images');
const GOOGLE_CREDS_PATH = path.join(PROJECT_ROOT, 'google.json');

// Set Google Credentials for local run
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDS_PATH;

// Setup Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Setup Local Service
const hybridService = new HybridVisionService(process.env.GEMINI_API_KEY);

async function runLocalDetection(imageBuffer, filename) {
  console.log(`[Local] Starting detection for ${filename}...`);
  const startTime = Date.now();
  try {
    const result = await hybridService.detectBooksFromImage(imageBuffer, {
      onProgress: (stage, progress, message) => {
        // console.log(`[Local] Progress: ${stage} ${progress}% - ${message}`);
      }
    });
    const duration = Date.now() - startTime;
    console.log(`[Local] Completed in ${duration}ms. Found ${result.books.length} books.`);
    return { 
      success: true, 
      count: result.books.length, 
      books: result.books, 
      duration,
      ocrBlocks: result.metadata?.ocrBlocksCount 
    };
  } catch (error) {
    console.error(`[Local] Failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runCloudDetection(imageBase64, filename) {
  console.log(`[Cloud] Starting detection for ${filename}...`);
  const startTime = Date.now();
  
  try {
    // 1. Create Job
    const { data: job, error: createError } = await supabase
      .from('detection_jobs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Placeholder or fetch a real user if needed
        status: 'processing',
        image_data: null // We send image directly to function to avoid storage upload in this test
      })
      .select()
      .single();

    if (createError) throw new Error(`Failed to create job: ${createError.message}`);

    // 2. Call Edge Function
    const functionUrl = `${supabaseUrl}/functions/v1/detect-books`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobId: job.id,
        imageData: imageBase64
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Function call failed: ${response.status} - ${text}`);
    }

    // 3. Poll for result
    let resultJob;
    while (true) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: polled } = await supabase
        .from('detection_jobs')
        .select('*')
        .eq('id', job.id)
        .single();
      
      if (polled.status === 'completed' || polled.status === 'failed') {
        resultJob = polled;
        break;
      }
      // console.log(`[Cloud] Polling... Status: ${polled.status}, Progress: ${polled.progress}%`);
    }

    const duration = Date.now() - startTime;
    
    if (resultJob.status === 'failed') {
      throw new Error(resultJob.error || 'Unknown cloud error');
    }

    const books = resultJob.result?.books || [];
    console.log(`[Cloud] Completed in ${duration}ms. Found ${books.length} books.`);
    
    return { 
      success: true, 
      count: books.length, 
      books: books, 
      duration 
    };

  } catch (error) {
    console.error(`[Cloud] Failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function compareResults(filename, local, cloud) {
  console.log(`\n--- Comparison for ${filename} ---`);
  console.log(`Local: ${local.success ? local.count + ' books' : 'FAILED'}`);
  console.log(`Cloud: ${cloud.success ? cloud.count + ' books' : 'FAILED'}`);
  
  if (local.success && cloud.success) {
    const diff = Math.abs(local.count - cloud.count);
    
    // Calculate intersection based on normalized titles
    const normalize = (str) => str.toLowerCase().replace(/[^\w\u0590-\u05FF]/g, '');
    const localTitles = new Set(local.books.map(b => normalize(b.title)));
    const cloudTitles = new Set(cloud.books.map(b => normalize(b.title)));
    
    let matchCount = 0;
    for (const title of localTitles) {
      if (cloudTitles.has(title)) matchCount++;
    }
    
    const matchPercent = Math.round((matchCount / Math.max(localTitles.size, cloudTitles.size)) * 100);
    console.log(`Title Match: ${matchCount} titles overlap (${matchPercent}%)`);

    if (diff > 0 || matchPercent < 80) {
      console.log(`Difference: ${diff} books.`);
      console.log('Local Titles (first 5):', local.books.slice(0, 5).map(b => b.title));
      console.log('Cloud Titles (first 5):', cloud.books.slice(0, 5).map(b => b.title));
    } else {
      console.log('Counts match and titles overlap significantly!');
    }
  }
  console.log('-----------------------------------\n');
}

async function main() {
  try {
    // Get a real user ID for the cloud job (optional, but good for RLS if we weren't using service key)
    // Using service key bypasses RLS, so 0000... might work if foreign key constraints allow.
    // Actually, detection_jobs has user_id REFERENCES auth.users. So we need a valid user ID.
    const { data: users } = await supabase.from('users').select('id').limit(1);
    let userId = users?.[0]?.id;
    
    if (!userId) {
      // Try to get from auth.users via admin api
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      userId = authUsers?.[0]?.id;
    }

    if (!userId) {
      console.warn('No user found. Cloud test might fail due to FK constraint.');
    } else {
      console.log(`Using User ID: ${userId}`);
    }

    // Override the insert in runCloudDetection to use this ID
    // (I'll just update the function above to take userId)
    
    const files = await fs.readdir(TEST_IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    console.log(`Found ${imageFiles.length} images.`);

    for (const file of imageFiles) {
      console.log(`\nProcessing ${file}...`);
      const filePath = path.join(TEST_IMAGES_DIR, file);
      const imageBuffer = await fs.readFile(filePath);
      const imageBase64 = imageBuffer.toString('base64');

      // Run Local
      const localResult = await runLocalDetection(imageBuffer, file);
      // const localResult = { success: false, count: 0, books: [], error: 'Skipped' };

      // Run Cloud
      // We need to patch the runCloudDetection to use the userId we found
      const cloudResult = await runCloudDetectionWithUser(imageBase64, file, userId);

      await compareResults(file, localResult, cloudResult);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

async function runCloudDetectionWithUser(imageBase64, filename, userId) {
   console.log(`[Cloud] Starting detection for ${filename}...`);
  const startTime = Date.now();
  
  try {
    // 1. Create Job
    const { data: job, error: createError } = await supabase
      .from('detection_jobs')
      .insert({
        user_id: userId,
        status: 'processing',
        image_data: null 
      })
      .select()
      .single();

    if (createError) throw new Error(`Failed to create job: ${createError.message}`);

    // 2. Call Edge Function
    const functionUrl = `${supabaseUrl}/functions/v1/detect-books`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobId: job.id,
        imageData: imageBase64
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Function call failed: ${response.status} - ${text}`);
    }

    // 3. Poll for result
    let resultJob;
    while (true) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: polled } = await supabase
        .from('detection_jobs')
        .select('*')
        .eq('id', job.id)
        .single();
      
      if (polled.status === 'completed' || polled.status === 'failed') {
        resultJob = polled;
        break;
      }
    }

    const duration = Date.now() - startTime;
    
    if (resultJob.status === 'failed') {
      throw new Error(resultJob.error || 'Unknown cloud error');
    }

    const books = resultJob.result?.books || [];
    console.log(`[Cloud] Completed in ${duration}ms. Found ${books.length} books.`);
    
    return { 
      success: true, 
      count: books.length, 
      books: books, 
      duration 
    };

  } catch (error) {
    console.error(`[Cloud] Failed:`, error.message);
    return { success: false, error: error.message };
  }
}

main();
