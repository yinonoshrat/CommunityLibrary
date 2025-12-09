#!/usr/bin/env node
/**
 * Local script to enrich catalog with genre and age_range
 * Runs directly against the database without needing API authentication
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import https from 'https'
import fetch from 'node-fetch'

// Disable SSL verification for local development (only for this script)
const agent = new https.Agent({
  rejectUnauthorized: false
})

// Override global fetch with custom agent
global.fetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    agent: url.startsWith('https') ? agent : undefined
  })
}

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production.local' 
  : '.env.development.local'

console.log(`Loading environment from: ${envFile}`)
config({ path: resolve(process.cwd(), envFile) })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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

async function enrichCatalog() {
  console.log('🚀 Starting catalog enrichment...\n')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  // Get all books without genre or age_level
  const { data: booksToEnrich, error: fetchError } = await supabase
    .from('book_catalog')
    .select('id, title, author, series, series_number, genre, age_level')
    .or('genre.is.null,age_level.is.null')

  if (fetchError) {
    console.error('❌ Error fetching books:', fetchError.message)
    process.exit(1)
  }

  if (!booksToEnrich || booksToEnrich.length === 0) {
    console.log('✓ All books already have genre and age_level!')
    process.exit(0)
  }

  console.log(`📚 Found ${booksToEnrich.length} books to enrich\n`)

  let enrichedCount = 0
  const BATCH_SIZE = 50

  // Process in batches
  for (let i = 0; i < booksToEnrich.length; i += BATCH_SIZE) {
    const batch = booksToEnrich.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(booksToEnrich.length / BATCH_SIZE)} (${batch.length} books)...`)

    // Build prompt for Gemini with book IDs
    const booksDetails = batch.map((book) => {
      let details = `ID: ${book.id}, Title: "${book.title}", Author: ${book.author || 'Unknown'}`
      if (book.series) {
        details += `, Series: ${book.series}`
        if (book.series_number) {
          details += ` #${book.series_number}`
        }
      }
      return details
    }).join('\n')

    const prompt = `You are a librarian assistant. Classify these Hebrew books by genre and age range.

Books:
${booksDetails}

Valid genres: ${GENRES.join(', ')}
Valid age ranges: ${AGE_LEVELS.join(', ')}

Respond ONLY with valid JSON array matching the book IDs exactly (no markdown, no code blocks):
[
  { "id": "actual-uuid-from-book", "genre": "genre-from-list", "age_level": "age-from-list" },
  ...
]

IMPORTANT: Use the exact ID from each book line. Use "אחר" for unknown genres and "מבוגרים" for unknown age ranges.`

    try {
      const result = await model.generateContent(prompt)
      const responseText = result.response.text()
      
      console.log(`  Raw response length: ${responseText.length} chars`)
      
      // Extract JSON from response (remove markdown if present)
      let jsonText = responseText.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
      }

      let classifications
      try {
        classifications = JSON.parse(jsonText)
      } catch (parseError) {
        console.error(`  ⚠ Failed to parse JSON response:`, parseError.message)
        console.error(`  Response text (first 500 chars):`, jsonText.substring(0, 500))
        continue
      }

      if (!Array.isArray(classifications)) {
        console.error(`  ⚠ Response is not an array`)
        continue
      }

      console.log(`  Received ${classifications.length} classifications`)

      // Update each book
      for (const classification of classifications) {
        const book = batch.find(b => b.id === classification.id)
        if (!book) continue

        const { error: updateError } = await supabase
          .from('book_catalog')
          .update({
            genre: classification.genre,
            age_level: classification.age_level
          })
          .eq('id', book.id)

        if (!updateError) {
          enrichedCount++
          console.log(`  ✓ ${book.title}: ${classification.genre}, ${classification.age_level}`)
        } else {
          console.warn(`  ⚠ Failed to update ${book.title}:`, updateError.message)
        }
      }

      // Rate limiting - wait 1 second between batches
      if (i + BATCH_SIZE < booksToEnrich.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
      console.error(`❌ Error processing batch:`, error.message)
      continue
    }
  }

  console.log(`\n✓ Enrichment completed!`)
  console.log(`📊 Results:`)
  console.log(`   - Total books checked: ${booksToEnrich.length}`)
  console.log(`   - Books enriched: ${enrichedCount}`)
}

enrichCatalog().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
