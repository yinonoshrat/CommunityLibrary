/**
 * Book Search Service
 * 
 * Searches for book details using Google Books API
 */

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Search for book details by title and author
 * @param {string} title - Book title
 * @param {string} author - Book author (optional)
 * @returns {Promise<Object|null>} Book details or null if not found
 */
export async function searchBookDetails(title, author = '') {
  try {
    console.log(`Searching for book: "${title}" by "${author}"`);
    
    // Strategy 1: Search with both title and author
    if (author) {
      const result = await searchWithStrategy(title, author, 'title+author');
      if (result && result.confidence >= 40) {
        return result;
      }
    }
    
    // Strategy 2: Search by title only (author might be misspelled/different language)
    const titleOnlyResult = await searchWithStrategy(title, '', 'title-only');
    if (titleOnlyResult) {
      // If we have an author to compare, verify it's a reasonable match
      if (author) {
        const authorSimilarity = calculateAuthorSimilarity(
          titleOnlyResult.author,
          author
        );
        
        // Accept if author is somewhat similar (>30%) or if book details are very complete
        if (authorSimilarity > 0.3 || titleOnlyResult.confidence >= 70) {
          console.log(`Found via title-only search (author similarity: ${Math.round(authorSimilarity * 100)}%)`);
          return titleOnlyResult;
        }
      } else {
        return titleOnlyResult;
      }
    }
    
    // Strategy 3: Try broader search with partial title
    if (title.length > 10) {
      const partialTitle = title.split(' ').slice(0, 3).join(' '); // First 3 words
      const broadResult = await searchWithStrategy(partialTitle, '', 'broad-title');
      if (broadResult) {
        // Verify the full title is similar
        const titleSimilarity = calculateSimilarity(
          normalizeString(broadResult.title),
          normalizeString(title)
        );
        
        if (titleSimilarity > 0.6) {
          console.log(`Found via broad search (title similarity: ${Math.round(titleSimilarity * 100)}%)`);
          return broadResult;
        }
      }
    }
    
    console.log(`No results found for: ${title}`);
    return null;

  } catch (error) {
    console.error('Book search error:', error);
    return null;
  }
}

/**
 * Search with a specific strategy
 * @param {string} title - Book title
 * @param {string} author - Book author
 * @param {string} strategy - Strategy name for logging
 * @returns {Promise<Object|null>} Book details or null
 */
async function searchWithStrategy(title, author, strategy) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Normalize title and author for search (remove niqqud, etc.)
      const normalizedTitle = normalizeString(title);
      const normalizedAuthor = author ? normalizeString(author) : '';
      
      // Build search query with normalized text
      const query = normalizedAuthor 
        ? `intitle:${normalizedTitle}+inauthor:${normalizedAuthor}`
        : `intitle:${normalizedTitle}`;

      const url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=he,en`;

      if (attempt > 1) {
        console.log(`  Strategy [${strategy}] attempt ${attempt}/${maxRetries}: ${query}`);
      } else {
        console.log(`  Strategy [${strategy}]: ${query}`);
      }

      const response = await fetch(url);
      
      // Handle rate limiting and server errors with retry
      if (response.status === 429 || response.status === 503 || response.status >= 500) {
        const errorMsg = `Google Books API ${response.status} error`;
        console.warn(`  ${errorMsg} - attempt ${attempt}/${maxRetries}`);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`  Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        lastError = new Error(errorMsg);
        break;
      }
      
      if (!response.ok) {
        console.warn(`  Google Books API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.log(`  No results for strategy: ${strategy}`);
        return null;
      }

      // Find the best match
      const bestMatch = findBestMatch(data.items, title, author);

      if (!bestMatch) {
        return null;
      }

      const volumeInfo = bestMatch.volumeInfo;
      const apiAuthor = volumeInfo.authors?.[0] || '';

      // Preserve original author language if provided
      // Strongly prefer Hebrew input over English transliterations from API
      let finalAuthor = author || apiAuthor;
      if (author && apiAuthor) {
        const hasHebrew = /[\u0590-\u05FF]/.test(author);
        const apiHasHebrew = /[\u0590-\u05FF]/.test(apiAuthor);
        
        if (hasHebrew && !apiHasHebrew) {
          // Input is Hebrew, API is not - always prefer Hebrew
          finalAuthor = author;
          console.log(`  Preserving Hebrew author "${author}" over API "${apiAuthor}"`);
        } else if (!hasHebrew && apiHasHebrew) {
          // Input is not Hebrew, API is - prefer API
          finalAuthor = apiAuthor;
          console.log(`  Using Hebrew API author "${apiAuthor}" over input "${author}"`);
        } else {
          // Both same script - check similarity
          const authorSim = calculateAuthorSimilarity(author, apiAuthor);
          if (authorSim < 0.5) {
            finalAuthor = apiAuthor;
            console.log(`  Using API author "${apiAuthor}" instead of input "${author}" (low similarity: ${Math.round(authorSim * 100)}%)`);
          } else {
            console.log(`  Preserving input author "${author}" (similarity: ${Math.round(authorSim * 100)}%)`);
          }
        }
      }

      // Preserve Hebrew title if provided
      const apiTitle = volumeInfo.title || title;
      let finalTitle = title;
      if (title && volumeInfo.title) {
        const hasHebrewTitle = /[\u0590-\u05FF]/.test(title);
        const apiHasHebrewTitle = /[\u0590-\u05FF]/.test(volumeInfo.title);
        
        if (!hasHebrewTitle && apiHasHebrewTitle) {
          // Input is not Hebrew but API has Hebrew - prefer API
          finalTitle = volumeInfo.title;
          console.log(`  Using Hebrew API title "${volumeInfo.title}" over input "${title}"`);
        } else if (hasHebrewTitle) {
          // Input is Hebrew - prefer it
          finalTitle = title;
          console.log(`  Preserving Hebrew title "${title}"`);
        } else {
          // Both non-Hebrew or API has no title - use API if available
          finalTitle = volumeInfo.title || title;
        }
      } else {
        finalTitle = apiTitle;
      }

      // Extract book details
      const bookDetails = {
        title: finalTitle,
        author: finalAuthor,
        publisher: volumeInfo.publisher || null,
        publish_year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
        pages: volumeInfo.pageCount || null,
        description: volumeInfo.description || null,
        cover_image_url: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null,
        isbn: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || 
              volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier || 
              null,
        genre: mapCategories(volumeInfo.categories),
        age_range: inferAgeRange(volumeInfo),
        language: volumeInfo.language || null,
        confidence: calculateConfidence(bestMatch, title, author)
      };

      console.log(`  ✓ Found: ${bookDetails.title} by ${bookDetails.author} (confidence: ${bookDetails.confidence})`);

      return bookDetails;

    } catch (error) {
      lastError = error;
      console.error(`  Strategy [${strategy}] attempt ${attempt} error:`, error.message);
      
      // Retry on network errors
      if (error.message?.includes('fetch failed') || error.code === 'ECONNRESET' || 
          error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        console.error('  Network error - retrying...');
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`  Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Don't retry for other errors
      break;
    }
  }
  
  if (lastError) {
    console.error(`  Strategy [${strategy}] failed after ${maxRetries} attempts`);
  }
  return null;
}

/**
 * Find the best matching book from search results
 */
function findBestMatch(items, searchTitle, searchAuthor) {
  if (!items || items.length === 0) return null;

  const normalizedSearchTitle = normalizeString(searchTitle);
  const normalizedSearchAuthor = normalizeString(searchAuthor);

  let bestMatch = items[0];
  let highestScore = 0;

  for (const item of items) {
    const volumeInfo = item.volumeInfo;
    const title = normalizeString(volumeInfo.title || '');
    const author = normalizeString(volumeInfo.authors?.[0] || '');

    let score = 0;

    // Title similarity (most important)
    if (title === normalizedSearchTitle) {
      score += 60; // Exact match
    } else if (title.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(title)) {
      score += 50;
    } else {
      const titleSim = calculateSimilarity(title, normalizedSearchTitle);
      if (titleSim > 0.8) {
        score += 45;
      } else if (titleSim > 0.6) {
        score += 30;
      } else if (titleSim > 0.4) {
        score += 15;
      }
    }

    // Author similarity (more lenient for different spellings/languages)
    if (searchAuthor && author) {
      const authorSim = calculateAuthorSimilarity(author, searchAuthor);
      
      if (authorSim > 0.9) {
        score += 30; // Very similar author
      } else if (authorSim > 0.7) {
        score += 25; // Similar author (different spelling/language)
      } else if (authorSim > 0.5) {
        score += 15; // Somewhat similar
      } else if (authorSim > 0.3) {
        score += 5; // Might be related
      }
    } else if (!searchAuthor && author) {
      // No author provided but book has author - small bonus
      score += 5;
    }

    // Data quality bonuses
    if (volumeInfo.industryIdentifiers?.length > 0) {
      score += 10; // Has ISBN
    }

    if (volumeInfo.imageLinks?.thumbnail) {
      score += 5; // Has cover image
    }

    if (volumeInfo.description && volumeInfo.description.length > 100) {
      score += 5; // Has substantial description
    }
    
    // Language preference bonus (Hebrew or English)
    if (volumeInfo.language === 'he' || volumeInfo.language === 'en') {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  console.log(`  Best match score: ${highestScore}`);
  return bestMatch;
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(item, searchTitle, searchAuthor) {
  const volumeInfo = item.volumeInfo;
  const title = normalizeString(volumeInfo.title || '');
  const author = normalizeString(volumeInfo.authors?.[0] || '');
  const normalizedSearchTitle = normalizeString(searchTitle);
  const normalizedSearchAuthor = normalizeString(searchAuthor);

  let confidence = 0;

  // Exact title match
  if (title === normalizedSearchTitle) {
    confidence += 50;
  } else if (title.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(title)) {
    confidence += 35;
  } else {
    confidence += calculateSimilarity(title, normalizedSearchTitle) * 30;
  }

  // Author match (if provided)
  if (searchAuthor && author) {
    if (author === normalizedSearchAuthor) {
      confidence += 30;
    } else if (author.includes(normalizedSearchAuthor) || normalizedSearchAuthor.includes(author)) {
      confidence += 20;
    } else {
      confidence += calculateSimilarity(author, normalizedSearchAuthor) * 15;
    }
  } else if (!searchAuthor) {
    // No author to compare, give moderate confidence
    confidence += 15;
  }

  // Data quality bonus
  if (volumeInfo.industryIdentifiers?.length > 0) confidence += 10;
  if (volumeInfo.imageLinks?.thumbnail) confidence += 5;
  if (volumeInfo.description) confidence += 5;

  return Math.min(100, Math.round(confidence));
}

/**
 * Normalize string for comparison
 */
function normalizeString(str) {
  return str
    .toLowerCase()
    // Remove Hebrew niqqud (vowel points) - Unicode range U+0591 to U+05C7
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[^\w\s\u0590-\u05FF]/g, '') // Keep alphanumeric and Hebrew
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate string similarity (0-1)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate author name similarity with special handling for different spellings/languages
 * @param {string} author1 - First author name
 * @param {string} author2 - Second author name
 * @returns {number} - Similarity score (0-1)
 */
function calculateAuthorSimilarity(author1, author2) {
  if (!author1 || !author2) return 0;
  
  const normalized1 = normalizeString(author1);
  const normalized2 = normalizeString(author2);
  
  // Check for exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Check if one contains the other (e.g., "J.K. Rowling" vs "Rowling")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.85;
  }
  
  // Split names into parts (first name, last name, etc.)
  const parts1 = normalized1.split(' ').filter(p => p.length > 0);
  const parts2 = normalized2.split(' ').filter(p => p.length > 0);
  
  // Check if last names match (most important part)
  if (parts1.length > 0 && parts2.length > 0) {
    const lastName1 = parts1[parts1.length - 1];
    const lastName2 = parts2[parts2.length - 1];
    
    // Exact last name match
    if (lastName1 === lastName2) return 0.9;
    
    // Similar last name
    const lastNameSimilarity = calculateSimilarity(lastName1, lastName2);
    if (lastNameSimilarity > 0.8) return 0.8;
  }
  
  // Check for common parts (first name or last name match)
  let commonParts = 0;
  for (const part1 of parts1) {
    if (part1.length <= 1) continue; // Skip initials
    for (const part2 of parts2) {
      if (part2.length <= 1) continue;
      if (part1 === part2 || calculateSimilarity(part1, part2) > 0.85) {
        commonParts++;
        break;
      }
    }
  }
  
  if (commonParts > 0) {
    return 0.6 + (commonParts * 0.15);
  }
  
  // Fall back to general string similarity
  return calculateSimilarity(normalized1, normalized2);
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Map Google Books categories to our genres
 */
function mapCategories(categories) {
  if (!categories || categories.length === 0) return null;

  const categoryMap = {
    'fiction': 'בדיה',
    'juvenile fiction': 'בדיה לילדים',
    'young adult fiction': 'בדיה לנוער',
    'fantasy': 'פנטזיה',
    'science fiction': 'מדע בדיוני',
    'mystery': 'מתח ומסתורין',
    'thriller': 'מתח ומסתורין',
    'romance': 'רומנטיקה',
    'biography': 'ביוגרפיה',
    'history': 'היסטוריה',
    'science': 'מדע',
    'self-help': 'עזרה עצמית',
    'cooking': 'בישול',
    'religion': 'דת',
    'poetry': 'שירה',
    'drama': 'דרמה',
    'comics': 'קומיקס'
  };

  const category = categories[0].toLowerCase();
  
  for (const [key, value] of Object.entries(categoryMap)) {
    if (category.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Infer age range from book info
 */
function inferAgeRange(volumeInfo) {
  const categories = volumeInfo.categories || [];
  const title = volumeInfo.title?.toLowerCase() || '';
  const description = volumeInfo.description?.toLowerCase() || '';

  for (const category of categories) {
    const cat = category.toLowerCase();
    if (cat.includes('juvenile') || cat.includes('children')) {
      return 'ילדים';
    }
    if (cat.includes('young adult')) {
      return 'נוער';
    }
  }

  // Check maturity rating
  if (volumeInfo.maturityRating === 'MATURE') {
    return 'מבוגרים';
  }

  // Check description and title keywords
  const childKeywords = ['children', 'kids', 'ילדים'];
  const teenKeywords = ['young adult', 'teen', 'נוער'];

  for (const keyword of childKeywords) {
    if (title.includes(keyword) || description.includes(keyword)) {
      return 'ילדים';
    }
  }

  for (const keyword of teenKeywords) {
    if (title.includes(keyword) || description.includes(keyword)) {
      return 'נוער';
    }
  }

  return null;
}
