/**
 * Book Search Service
 * 
 * Multi-provider book search supporting Simania and Google Books
 */

const SIMANIA_API = 'https://simania.co.il/api/search';
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

// Search provider configuration
const PROVIDERS = {
  simania: {
    enabled: true,
    name: 'Simania',
    search: searchSimania
  },
  google: {
    enabled: false, // Disabled for now, keep for future use
    name: 'Google Books',
    search: searchGoogleBooks
  }
};

/**
 * Search for books using query string
 * @param {string} query - Search query (title, author, ISBN, etc.)
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of book results
 */
export async function searchBooks(query, options = {}) {
  const { provider = 'auto', maxResults = 10 } = options;
  
  try {
    console.log(`Searching books: "${query}" (provider: ${provider})`);
    
    // Auto mode: try enabled providers in order
    if (provider === 'auto') {
      for (const [key, config] of Object.entries(PROVIDERS)) {
        if (config.enabled) {
          console.log(`  Trying provider: ${config.name}`);
          const results = await config.search(query, maxResults);
          if (results && results.length > 0) {
            console.log(`  ✓ Found ${results.length} results from ${config.name}`);
            return results;
          }
        }
      }
      console.log('  No results found from any provider');
      return [];
    }
    
    // Specific provider requested
    const config = PROVIDERS[provider];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    if (!config.enabled) {
      throw new Error(`Provider ${provider} is disabled`);
    }
    
    return await config.search(query, maxResults);
    
  } catch (error) {
    console.error('Book search error:', error);
    throw error;
  }
}

/**
 * Search for book details by title and author (legacy API for bulk upload)
 * @param {string} title - Book title
 * @param {string} author - Book author (optional)
 * @returns {Promise<Object|null>} Book details or null if not found
 */
export async function searchBookDetails(title, author = '') {
  try {
    console.log(`Searching for book details: "${title}" by "${author}"`);
    
    // 1. Try searching with Title + Author
    let query = author ? `${title} ${author}` : title;
    let results = await searchBooks(query, { maxResults: 5 });
    
    // 2. If no results and we have an author, try searching by Title only
    if ((!results || results.length === 0) && author) {
      console.log(`No results for "${title} ${author}", retrying with title only: "${title}"`);
      query = title;
      results = await searchBooks(query, { maxResults: 5 });
    }
    
    if (!results || results.length === 0) {
      return null;
    }
    
    // Find best match
    const bestMatch = findBestMatch(results, title, author);
    return bestMatch;
    
  } catch (error) {
    console.error('Book details search error:', error);
    return null;
  }
}

/**
 * Search Simania API
 */
async function searchSimania(query, maxResults = 10) {
  try {
    const url = `${SIMANIA_API}?query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Simania API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data?.books || data.data.books.length === 0) {
      return [];
    }
    
    // Map Simania results to our format
    const results = data.data.books.slice(0, maxResults).map(book => {
      let coverImageUrl = null;
      
      // Handle different cover image URL formats from Simania
      if (book.COVER) {
        coverImageUrl = book.COVER;
      } else if (book.imageLink) {
        const imagePath = book.imageLink;
        
        // Check if it's a loadJpg.php URL and extract the direct image path
        if (imagePath.includes('loadJpg.php')) {
          try {
            // Extract imageName parameter from URL like: /bookimages/loadJpg.php?imageName=covers0/1239.jpg
            const match = imagePath.match(/[?&]imageName=([^&]+)/);
            if (match && match[1]) {
              // Convert to direct image URL
              coverImageUrl = `https://simania.co.il/bookimages/${match[1]}`;
            } else {
              // Fallback: use the URL as-is
              coverImageUrl = `https://simania.co.il${imagePath}`;
            }
          } catch (e) {
            console.warn('Failed to parse loadJpg.php URL:', imagePath);
            coverImageUrl = `https://simania.co.il${imagePath}`;
          }
        } else {
          // Direct image URL
          coverImageUrl = `https://simania.co.il${imagePath}`;
        }
      }
      
      return {
        title: book.NAME || '',
        author: book.AUTHOR || '',
        publisher: book.PUBLISHER || null,
        publish_year: book.YEAR || book.bookYear || null,
        pages: book.PAGES || null,
        description: book.DESCRIPTION || null,
        cover_image_url: coverImageUrl,
        isbn: book.ISBN || null,
        genre: book.CATEGORY || null,
        series: book.SERIES || null,
        series_number: book.seriesNumber ? parseSeriesNumber(book.seriesNumber) : null,
        language: 'he', // Simania is Hebrew
        source: 'Simania',
        confidence: 85 // High confidence for direct matches
      };
    });
    
    return results;
    
  } catch (error) {
    console.error('Simania search error:', error);
    return [];
  }
}

/**
 * Search Google Books API (kept for future use)
 */
async function searchGoogleBooks(query, maxResults = 10) {
  try {
    const url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=${maxResults}&langRestrict=he,en`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Google Books API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }
    
    // Map Google Books results to our format
    const results = data.items.map(item => {
      const volumeInfo = item.volumeInfo;
      const { series, seriesNumber } = extractSeriesInfo(volumeInfo);
      
      return {
        title: volumeInfo.title || '',
        author: volumeInfo.authors?.[0] || '',
        publisher: volumeInfo.publisher || null,
        publish_year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
        pages: volumeInfo.pageCount || null,
        description: volumeInfo.description || null,
        cover_image_url: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null,
        isbn: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier || 
              volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier || 
              null,
        genre: mapCategories(volumeInfo.categories),
        language: volumeInfo.language || null,
        series,
        series_number: seriesNumber,
        source: 'Google Books',
        confidence: 75
      };
    });
    
    return results;
    
  } catch (error) {
    console.error('Google Books search error:', error);
    return [];
  }
}

/**
 * Find the best matching book from search results
 */
function findBestMatch(results, searchTitle, searchAuthor) {
  if (!results || results.length === 0) return null;

  const normalizedSearchTitle = normalizeString(searchTitle);
  const normalizedSearchAuthor = normalizeString(searchAuthor);

  let bestMatch = results[0];
  let highestScore = 0;

  for (const book of results) {
    const title = normalizeString(book.title || '');
    const author = normalizeString(book.author || '');

    let score = 0;

    // Title similarity (most important)
    if (title === normalizedSearchTitle) {
      score += 60;
    } else if (title.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(title)) {
      score += 50;
    } else {
      const titleSim = calculateSimilarity(title, normalizedSearchTitle);
      if (titleSim > 0.8) score += 45;
      else if (titleSim > 0.6) score += 30;
      else if (titleSim > 0.4) score += 15;
    }

    // Author similarity
    if (searchAuthor && author) {
      const authorSim = calculateAuthorSimilarity(author, searchAuthor);
      if (authorSim > 0.9) score += 30;
      else if (authorSim > 0.7) score += 25;
      else if (authorSim > 0.5) score += 15;
      else if (authorSim > 0.3) score += 5;
    }

    // Data quality bonuses
    if (book.isbn) score += 10;
    if (book.cover_image_url) score += 5;
    if (book.description && book.description.length > 100) score += 5;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = book;
    }
  }

  console.log(`  Best match score: ${highestScore}`);
  return bestMatch;
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

function extractSeriesInfo(volumeInfo) {
  if (!volumeInfo) {
    return { series: null, seriesNumber: null };
  }

  const seriesInfo = volumeInfo.seriesInfo || volumeInfo.seriesinfo;
  const result = { series: null, seriesNumber: null };

  if (seriesInfo) {
    result.series = seriesInfo.bookDisplaySeriesTitle
      || seriesInfo.series
      || seriesInfo.seriesTitle
      || null;

    if (!result.series && Array.isArray(seriesInfo.volumeSeries) && seriesInfo.volumeSeries.length > 0) {
      result.series = seriesInfo.volumeSeries[0].series || null;
      result.seriesNumber = parseSeriesNumber(seriesInfo.volumeSeries[0].volumeSeriesNumber);
    }

    if (seriesInfo.volumeSeriesNumber && result.seriesNumber == null) {
      result.seriesNumber = parseSeriesNumber(seriesInfo.volumeSeriesNumber);
    }
  }

  // Try parsing common subtitle format: "Book 3 of The Series"
  if (!result.series && volumeInfo.subtitle) {
    const subtitle = volumeInfo.subtitle;
    const match = subtitle.match(/Book\s+(\d+)\s+of\s+(.+)/i);
    if (match) {
      result.seriesNumber = parseSeriesNumber(match[1]);
      result.series = match[2].trim();
    }
  }

  // Look for patterns like "Series Name #4" in title
  if (!result.series) {
    const titlePattern = volumeInfo.title?.match(/(.+?)\s+[\-–]\s+Book\s+(\d+)/i)
      || volumeInfo.title?.match(/(.+?)\s+#(\d+)/)
      || volumeInfo.title?.match(/(.+?)\s+,?\s*חלק\s+(\d+)/);
    if (titlePattern) {
      result.series = titlePattern[1].trim();
      result.seriesNumber = result.seriesNumber ?? parseSeriesNumber(titlePattern[2]);
    }
  }

  // Check description for "Book X of Y"
  if (!result.series && volumeInfo.description) {
    const descriptionMatch = volumeInfo.description.match(/Book\s+(\d+)\s+of\s+([^\.\n]+)/i);
    if (descriptionMatch) {
      result.seriesNumber = parseSeriesNumber(descriptionMatch[1]);
      result.series = descriptionMatch[2].trim();
    }
  }

  return result;
}

function parseSeriesNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const match = String(value).match(/\d+/);
  if (match) {
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}
