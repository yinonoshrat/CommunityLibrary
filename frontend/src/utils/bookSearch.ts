/**
 * Book Search Utility
 * 
 * Extensible book search system that supports multiple data sources.
 * To add a new source, create a class that implements the BookSearchSource interface
 * and add it to the SEARCH_SOURCES array.
 */
const NLI_API_KEY = "wguym9YWCUagh1o7ZkU17pVgpSp890FDSu5v46iR"; // Replace with your actual API key

export interface BookSearchResult {
  title: string;
  author: string;
  isbn: string;
  year_published: number;
  publisher: string;
  pages: number;
  summary: string;
  cover_image_url: string;
  source: string;
  categories?: string[]; // Google Books categories for genre deduction
}

export interface BookSearchSource {
  /** Unique identifier for this source */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Perform the search */
  search(query: string): Promise<BookSearchResult[]>;
}

/**
 * Israel National Library Search Source
 */
class IsraelNationalLibrarySource implements BookSearchSource {
  name = 'inl';
  displayName = 'הספרייה הלאומית';

  async search(query: string): Promise<BookSearchResult[]> {
    try {
      const response = await fetch(
        `https://api.nli.org.il/openlibrary/search?api_key=${NLI_API_KEY}&query=any,contains,${encodeURIComponent(query)}&limit=10&material_type=book`,
        { 
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );
      
      if (!response.ok) {
        throw new Error(`INL API returned ${response.status}`);
      }
      
      const data = await response.json();
      const results: BookSearchResult[] = [];
      
      // NLI API returns JSON-LD format with Dublin Core elements
      if (Array.isArray(data)) {
        for (const doc of data) {
          // Extract values from Dublin Core format: http://purl.org/dc/elements/1.1/fieldname
          const getFirstValue = (field: string) => {
            const values = doc[`http://purl.org/dc/elements/1.1/${field}`];
            if (Array.isArray(values) && values.length > 0) {
              return values[0]['@value'] || '';
            }
            return '';
          };

          const title = getFirstValue('title');
          const creator = getFirstValue('creator');
          const date = getFirstValue('date');
          const publisher = getFirstValue('publisher');
          const thumbnail = getFirstValue('thumbnail');
          const description = getFirstValue('description');
          const identifier = getFirstValue('identifier');
          
          // Only add if we have at least a title
          if (title) {
            results.push({
              title,
              author: creator,
              isbn: identifier, // Use identifier as fallback for ISBN
              year_published: date ? parseInt(date.substring(0, 4)) : 0, // Extract year from YYYYMMDD format
              publisher: publisher,
              pages: 0,
              summary: description,
              cover_image_url: thumbnail,
              source: this.displayName,
            });
          }
        }
      }
      
      return results;
    } catch (err) {
      console.error('Israel National Library search failed:', err);
      return [];
    }
  }
}

/**
 * Google Books Search Source
 */
class GoogleBooksSource implements BookSearchSource {
  name = 'google';
  displayName = 'Google Books';

  async search(query: string): Promise<BookSearchResult[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=he`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) {
        throw new Error(`Google Books API returned ${response.status}`);
      }
      
      const data = await response.json();
      const results: BookSearchResult[] = [];
      
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          const volumeInfo = item.volumeInfo;
          
          // Extract ISBN
          let isbn = '';
          if (volumeInfo.industryIdentifiers && Array.isArray(volumeInfo.industryIdentifiers)) {
            const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_13');
            const isbn10 = volumeInfo.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
            isbn = isbn13?.identifier || isbn10?.identifier || '';
          }
          
          // Extract categories
          const categories = volumeInfo.categories && Array.isArray(volumeInfo.categories) 
            ? volumeInfo.categories 
            : [];
          
          results.push({
            title: volumeInfo.title || '',
            author: Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(', ') : '',
            isbn,
            year_published: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.toString()) : 0,
            publisher: volumeInfo.publisher || '',
            pages: volumeInfo.pageCount || 0,
            summary: volumeInfo.description || '',
            cover_image_url: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || '',
            source: this.displayName,
            categories,
          });
        }
      }
      
      return results;
    } catch (err) {
      console.error('Google Books search failed:', err);
      return [];
    }
  }
}

/**
 * Open Library Search Source (Example - currently disabled)
 * Uncomment and add to SEARCH_SOURCES to enable
 */
class OpenLibrarySource implements BookSearchSource {
  name = 'openlibrary';
  displayName = 'Open Library';
  priority = 3;

  async search(query: string): Promise<BookSearchResult[]> {
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) {
        throw new Error(`Open Library API returned ${response.status}`);
      }
      
      const data = await response.json();
      const results: BookSearchResult[] = [];
      
      if (data.docs && Array.isArray(data.docs)) {
        for (const doc of data.docs) {
          results.push({
            title: doc.title || '',
            author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '',
            isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : '',
            year_published: doc.first_publish_year || 0,
            publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : '',
            pages: doc.number_of_pages_median || 0,
            summary: '',
            cover_image_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            source: this.displayName,
          });
        }
      }
      
      return results;
    } catch (err) {
      console.error('Open Library search failed:', err);
      return [];
    }
  }
}

/**
 * Registered search sources (sorted by priority)
 * To add a new source:
 * 1. Create a class that implements BookSearchSource
 * 2. Add an instance to this array
 * 3. The system will automatically use it based on priority
 */
const SEARCH_SOURCES: BookSearchSource[] = [
  new GoogleBooksSource(),
  new IsraelNationalLibrarySource(),
  // new OpenLibrarySource(), // Uncomment to enable
]

/**
 * Search Strategy
 */
export type SearchStrategy = 'sequential' | 'parallel' | 'first-match';

interface SearchOptions {
  /** Search strategy to use */
  strategy?: SearchStrategy;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Specific sources to search (if empty, searches all) */
  sources?: string[];
}

/**
 * Main search function
 * 
 * @param query - The search query
 * @param options - Search options
 * @returns Array of book search results
 */
export async function searchBooks(
  query: string,
  options: SearchOptions = {}
): Promise<BookSearchResult[]> {
  const {
    strategy = 'sequential',
    maxResults = 10,
    sources = [],
  } = options;

  if (!query.trim()) {
    return [];
  }

  // Filter sources if specific ones are requested
  let sourcesToSearch = SEARCH_SOURCES;
  if (sources.length > 0) {
    sourcesToSearch = SEARCH_SOURCES.filter(source => sources.includes(source.name));
  }

  let allResults: BookSearchResult[] = [];

  switch (strategy) {
    case 'sequential':
      // Search sources one by one (stops when results are found)
      for (const source of sourcesToSearch) {
        const results = await source.search(query);
        if (results.length > 0) {
          allResults = results;
          break; // Stop after first source with results
        }
      }
      break;

    case 'parallel':
      // Search all sources simultaneously and combine results
      const promises = sourcesToSearch.map(source => source.search(query));
      const resultsArrays = await Promise.all(promises);
      allResults = resultsArrays.flat();
      break;

    case 'first-match':
      // Race all sources and return first result
      const raceResults = await Promise.race(
        sourcesToSearch.map(source => source.search(query))
      );
      allResults = raceResults;
      break;
  }

  // Remove duplicates based on ISBN or title
  const uniqueResults = removeDuplicates(allResults);

  // Limit results
  return uniqueResults.slice(0, maxResults);
}

/**
 * Remove duplicate results
 */
function removeDuplicates(results: BookSearchResult[]): BookSearchResult[] {
  const seen = new Set<string>();
  const unique: BookSearchResult[] = [];

  for (const result of results) {
    // Create a unique key based on ISBN or title+author
    const key = result.isbn 
      ? `isbn:${result.isbn}`
      : `title:${result.title.toLowerCase()}:${result.author.toLowerCase()}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  return unique;
}

/**
 * Get list of available search sources
 */
export function getAvailableSources(): Array<{ name: string; displayName: string }> {
  return SEARCH_SOURCES.map(source => ({
    name: source.name,
    displayName: source.displayName,
  }));
}

/**
 * Search a specific source by name
 */
export async function searchBySource(
  sourceName: string,
  query: string
): Promise<BookSearchResult[]> {
  const source = SEARCH_SOURCES.find(s => s.name === sourceName);
  if (!source) {
    throw new Error(`Unknown source: ${sourceName}`);
  }
  return source.search(query);
}
