#!/usr/bin/env node
/**
 * Test script to compare different Gemini models for book detection
 * Usage: node scripts/test-detection-models.js <test-images-directory>
 */

import { config } from 'dotenv'
import { resolve, join, basename } from 'path'
import { readdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import https from 'https'
import fetch from 'node-fetch'

// Disable SSL verification for local development
const agent = new https.Agent({
  rejectUnauthorized: false
})

global.fetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    agent: url.startsWith('https') ? agent : undefined
  })
}

// Load environment variables
config({ path: resolve(process.cwd(), '.env.development.local') })

// Import after env is loaded
const HybridVisionServiceModule = await import('../backend_shared_src/services/hybridVision.js')
const HybridVisionService = HybridVisionServiceModule.default

// Models to test
const MODELS_TO_TEST = [
  'gemini-2.5-flash',
]

/**
 * Normalize book data for comparison
 */
function normalizeBook(book) {
  return {
    title: (book.title || '').trim().toLowerCase(),
    author: (book.author || '').trim().toLowerCase(),
    series: (book.series || '').trim().toLowerCase(),
    series_number: book.series_number || null,
    genre: book.genre || null,
    age_range: book.age_range || null
  }
}

/**
 * Create a simple key for book matching (title only, most reliable)
 */
function createBookKey(book) {
  const normalized = normalizeBook(book)
  // Use title as primary key - most reliable identifier
  return normalized.title
}

/**
 * Check if two books are the same (fuzzy match on author)
 */
function isSameBook(book1, book2) {
  const n1 = normalizeBook(book1)
  const n2 = normalizeBook(book2)
  
  // Title must match
  if (n1.title !== n2.title) {
    return false
  }
  
  // If both have authors, they should be similar
  if (n1.author && n2.author) {
    // Check if one author contains the other (handles "רואלד דאל" vs "רואלד")
    if (n1.author.includes(n2.author) || n2.author.includes(n1.author)) {
      return true
    }
    // Exact match
    if (n1.author === n2.author) {
      return true
    }
    // Authors differ significantly
    return false
  }
  
  // If one or both missing author, consider them the same book by title
  return true
}

/**
 * Compare two book arrays (order-independent)
 */
function compareBooks(books1, books2) {
  const onlyIn1 = []
  const onlyIn2 = []
  const inBoth = []
  const different = []

  // Create maps by title for quick lookup
  const map1 = new Map()
  const map2 = new Map()
  
  books1.forEach(book => {
    const key = createBookKey(book)
    if (!map1.has(key)) {
      map1.set(key, [])
    }
    map1.get(key).push(book)
  })
  
  books2.forEach(book => {
    const key = createBookKey(book)
    if (!map2.has(key)) {
      map2.set(key, [])
    }
    map2.get(key).push(book)
  })

  const processed1 = new Set()
  const processed2 = new Set()

  // Find matches and differences
  for (const [key1, booksWithKey1] of map1) {
    for (const book1 of booksWithKey1) {
      if (processed1.has(book1)) continue
      
      let foundMatch = false
      
      // Look for matching book in second set
      if (map2.has(key1)) {
        for (const book2 of map2.get(key1)) {
          if (processed2.has(book2)) continue
          
          if (isSameBook(book1, book2)) {
            foundMatch = true
            processed1.add(book1)
            processed2.add(book2)
            
            // Check if metadata differs
            const n1 = normalizeBook(book1)
            const n2 = normalizeBook(book2)
            
            if (n1.genre !== n2.genre || n1.age_range !== n2.age_range) {
              different.push({
                book: book1.title,
                model1: { genre: book1.genre, age_range: book1.age_range },
                model2: { genre: book2.genre, age_range: book2.age_range }
              })
            } else {
              inBoth.push(book1)
            }
            break
          }
        }
      }
      
      if (!foundMatch) {
        onlyIn1.push(book1)
        processed1.add(book1)
      }
    }
  }

  // Find books only in second set
  for (const [key2, booksWithKey2] of map2) {
    for (const book2 of booksWithKey2) {
      if (!processed2.has(book2)) {
        onlyIn2.push(book2)
      }
    }
  }

  return {
    onlyInFirst: onlyIn1,
    onlyInSecond: onlyIn2,
    inBoth: inBoth,
    differentMetadata: different
  }
}

/**
 * Test single image with single model
 */
async function testImageWithModel(imageBuffer, imageName, modelName) {
  console.log(`  Testing with ${modelName}...`)
  
  const startTime = Date.now()
  
  try {
    const visionService = new HybridVisionService({ geminiModel: modelName })
    
    // Intercept the model's generateContent to capture raw response
    const originalGenerateContent = visionService.model.generateContent.bind(visionService.model)
    let rawResponse = null
    
    visionService.model.generateContent = async function(...args) {
      const result = await originalGenerateContent(...args)
      const response = await result.response
      rawResponse = response.text()
      
      // Save raw response to file for debugging
      const { mkdir } = await import('fs/promises')
      const outputDir = resolve(process.cwd(), 'test-model-responses')
      
      try {
        await mkdir(outputDir, { recursive: true })
      } catch (e) {
        // Directory might already exist
      }
      
      const sanitizedImageName = imageName.replace(/[^a-zA-Z0-9-]/g, '_')
      const sanitizedModelName = modelName.replace(/[^a-zA-Z0-9-]/g, '_')
      const responseFile = join(outputDir, `${sanitizedImageName}_${sanitizedModelName}_response.json`)
      
      await writeFile(responseFile, rawResponse, 'utf8')
      console.log(`    → Raw response saved to: ${responseFile}`)
      
      return result
    }
    
    const books = await visionService.detectBooksFromImage(imageBuffer)
    
    const duration = Date.now() - startTime
    
    return {
      success: true,
      model: modelName,
      books,
      count: books.length,
      duration,
      error: null,
      rawResponseFile: rawResponse ? `test-model-responses/${imageName.replace(/[^a-zA-Z0-9-]/g, '_')}_${modelName.replace(/[^a-zA-Z0-9-]/g, '_')}_response.json` : null
    }
  } catch (error) {
    const duration = Date.now() - startTime
    
    return {
      success: false,
      model: modelName,
      books: [],
      count: 0,
      duration,
      error: error.message
    }
  }
}

/**
 * Test single image with all models
 */
async function testImage(imagePath, imageName) {
  console.log(`\nTesting image: ${imageName}`)
  
  const imageBuffer = await readFile(imagePath)
  const results = []
  
  for (const model of MODELS_TO_TEST) {
    const result = await testImageWithModel(imageBuffer, imageName, model)
    results.push(result)
    
    if (result.success) {
      console.log(`    ✓ ${model}: ${result.count} books in ${result.duration}ms`)
    } else {
      console.log(`    ✗ ${model}: FAILED - ${result.error}`)
    }
  }
  
  return {
    image: imageName,
    results
  }
}

/**
 * Generate comparison report
 */
function generateReport(testResults) {
  const lines = []
  
  lines.push('=' .repeat(80))
  lines.push('BOOK DETECTION MODEL COMPARISON REPORT')
  lines.push('=' .repeat(80))
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Models tested: ${MODELS_TO_TEST.join(', ')}`)
  lines.push(`Total images: ${testResults.length}`)
  lines.push('')
  
  // Overall statistics
  lines.push('=' .repeat(80))
  lines.push('OVERALL STATISTICS')
  lines.push('=' .repeat(80))
  lines.push('')
  
  const modelStats = {}
  MODELS_TO_TEST.forEach(model => {
    modelStats[model] = {
      totalBooks: 0,
      successfulImages: 0,
      failedImages: 0,
      totalDuration: 0,
      avgBooksPerImage: 0
    }
  })
  
  testResults.forEach(imageResult => {
    imageResult.results.forEach(modelResult => {
      const stats = modelStats[modelResult.model]
      if (modelResult.success) {
        stats.successfulImages++
        stats.totalBooks += modelResult.count
        stats.totalDuration += modelResult.duration
      } else {
        stats.failedImages++
      }
    })
  })
  
  MODELS_TO_TEST.forEach(model => {
    const stats = modelStats[model]
    stats.avgBooksPerImage = stats.successfulImages > 0 
      ? (stats.totalBooks / stats.successfulImages).toFixed(2)
      : 0
    const avgDuration = stats.successfulImages > 0
      ? (stats.totalDuration / stats.successfulImages).toFixed(0)
      : 0
    
    lines.push(`${model}:`)
    lines.push(`  Total books detected: ${stats.totalBooks}`)
    lines.push(`  Successful images: ${stats.successfulImages}`)
    lines.push(`  Failed images: ${stats.failedImages}`)
    lines.push(`  Average books per image: ${stats.avgBooksPerImage}`)
    lines.push(`  Average duration: ${avgDuration}ms`)
    lines.push('')
  })
  
  // Detailed results per image
  lines.push('=' .repeat(80))
  lines.push('DETAILED RESULTS PER IMAGE')
  lines.push('=' .repeat(80))
  lines.push('')
  
  testResults.forEach(imageResult => {
    lines.push('-'.repeat(80))
    lines.push(`IMAGE: ${imageResult.image}`)
    lines.push('-'.repeat(80))
    lines.push('')
    
    imageResult.results.forEach(modelResult => {
      lines.push(`  ${modelResult.model}:`)
      if (modelResult.success) {
        lines.push(`    Status: SUCCESS`)
        lines.push(`    Books detected: ${modelResult.count}`)
        lines.push(`    Duration: ${modelResult.duration}ms`)
        lines.push(`    Books:`)
        modelResult.books.forEach((book, idx) => {
          let bookStr = `      ${idx + 1}. "${book.title}" by ${book.author || 'Unknown'}`
          if (book.series) {
            bookStr += ` (${book.series}${book.series_number ? ` #${book.series_number}` : ''})`
          }
          if (book.genre) {
            bookStr += ` [${book.genre}]`
          }
          if (book.age_range) {
            bookStr += ` [${book.age_range}]`
          }
          lines.push(bookStr)
        })
      } else {
        lines.push(`    Status: FAILED`)
        lines.push(`    Error: ${modelResult.error}`)
      }
      lines.push('')
    })
  })
  
  // Comparison between models
  if (MODELS_TO_TEST.length >= 2) {
    lines.push('=' .repeat(80))
    lines.push('MODEL COMPARISON ANALYSIS')
    lines.push('=' .repeat(80))
    lines.push('')
    
    testResults.forEach(imageResult => {
      const successfulResults = imageResult.results.filter(r => r.success)
      
      if (successfulResults.length >= 2) {
        lines.push(`Image: ${imageResult.image}`)
        lines.push('')
        
        // Compare first model with others
        const baseResult = successfulResults[0]
        
        for (let i = 1; i < successfulResults.length; i++) {
          const compareResult = successfulResults[i]
          const comparison = compareBooks(baseResult.books, compareResult.books)
          
          lines.push(`  ${baseResult.model} vs ${compareResult.model}:`)
          lines.push(`    Books in both: ${comparison.inBoth.length}`)
          lines.push(`    Only in ${baseResult.model}: ${comparison.onlyInFirst.length}`)
          if (comparison.onlyInFirst.length > 0) {
            comparison.onlyInFirst.forEach(book => {
              lines.push(`      - "${book.title}" by ${book.author || 'Unknown'}`)
            })
          }
          lines.push(`    Only in ${compareResult.model}: ${comparison.onlyInSecond.length}`)
          if (comparison.onlyInSecond.length > 0) {
            comparison.onlyInSecond.forEach(book => {
              lines.push(`      - "${book.title}" by ${book.author || 'Unknown'}`)
            })
          }
          
          if (comparison.differentMetadata.length > 0) {
            lines.push(`    Different metadata: ${comparison.differentMetadata.length}`)
            comparison.differentMetadata.forEach(diff => {
              lines.push(`      - "${diff.book}":`)
              lines.push(`        ${baseResult.model}: genre="${diff.model1.genre}", age="${diff.model1.age_range}"`)
              lines.push(`        ${compareResult.model}: genre="${diff.model2.genre}", age="${diff.model2.age_range}"`)
            })
          }
          lines.push('')
        }
      }
    })
  }
  
  // Summary
  lines.push('=' .repeat(80))
  lines.push('SUMMARY')
  lines.push('=' .repeat(80))
  lines.push('')
  
  // Best performing model
  let bestModel = MODELS_TO_TEST[0]
  let maxBooks = modelStats[bestModel].totalBooks
  MODELS_TO_TEST.forEach(model => {
    if (modelStats[model].totalBooks > maxBooks) {
      maxBooks = modelStats[model].totalBooks
      bestModel = model
    }
  })
  
  lines.push(`Best performing model (most books detected): ${bestModel} (${maxBooks} books)`)
  
  // Most reliable model
  let mostReliable = MODELS_TO_TEST[0]
  let maxSuccess = modelStats[mostReliable].successfulImages
  MODELS_TO_TEST.forEach(model => {
    if (modelStats[model].successfulImages > maxSuccess) {
      maxSuccess = modelStats[model].successfulImages
      mostReliable = model
    }
  })
  
  lines.push(`Most reliable model (fewest failures): ${mostReliable} (${modelStats[mostReliable].failedImages} failures)`)
  
  // Fastest model
  let fastestModel = MODELS_TO_TEST[0]
  let minAvgDuration = modelStats[fastestModel].successfulImages > 0
    ? modelStats[fastestModel].totalDuration / modelStats[fastestModel].successfulImages
    : Infinity
  MODELS_TO_TEST.forEach(model => {
    const avgDuration = modelStats[model].successfulImages > 0
      ? modelStats[model].totalDuration / modelStats[model].successfulImages
      : Infinity
    if (avgDuration < minAvgDuration) {
      minAvgDuration = avgDuration
      fastestModel = model
    }
  })
  
  lines.push(`Fastest model (avg duration): ${fastestModel} (${minAvgDuration.toFixed(0)}ms)`)
  lines.push('')
  lines.push('=' .repeat(80))
  
  return lines.join('\n')
}

/**
 * Main function
 */
async function main() {
  const testDir = process.argv[2]
  
  if (!testDir) {
    console.error('Usage: node scripts/test-detection-models.js <test-images-directory>')
    console.error('Example: node scripts/test-detection-models.js ./test-images')
    process.exit(1)
  }
  
  if (!existsSync(testDir)) {
    console.error(`Error: Directory not found: ${testDir}`)
    process.exit(1)
  }
  
  console.log('📊 Book Detection Model Comparison Test')
  console.log(`📁 Test directory: ${testDir}`)
  console.log(`🤖 Models: ${MODELS_TO_TEST.join(', ')}`)
  console.log('')
  
  // Get all image files
  const files = await readdir(testDir)
  const imageFiles = files.filter(f => 
    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f)
  )
  
  if (imageFiles.length === 0) {
    console.error('Error: No image files found in directory')
    process.exit(1)
  }
  
  console.log(`Found ${imageFiles.length} images to test`)
  
  // Test each image
  const testResults = []
  for (const imageFile of imageFiles) {
    const imagePath = join(testDir, imageFile)
    const result = await testImage(imagePath, imageFile)
    testResults.push(result)
  }
  
  // Generate report
  console.log('\n📝 Generating report...')
  const report = generateReport(testResults)
  
  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const reportPath = join(process.cwd(), `detection-comparison-report-${timestamp}.txt`)
  await writeFile(reportPath, report, 'utf8')
  
  console.log(`\n✓ Report saved to: ${reportPath}`)
  console.log('\nTest completed!')
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})
