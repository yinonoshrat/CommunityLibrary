/**
 * Book Search Utility
 * 
 * Searches for books using the backend API which supports multiple providers
 */

export interface BookSearchResult {
  title: string;
  author: string;
  isbn: string;
  publish_year: number;
  publisher: string;
  pages: number;
  description: string;
  cover_image_url: string;
  source: string;
  genre?: string | null;
  series?: string | null;
  series_number?: number | null;
  language?: string;
  confidence?: number;
}

export interface SearchOptions {
  /** Search provider (auto, simania, google) */
  provider?: string;
  /** Maximum number of results to return */
  maxResults?: number;
}

/**
 * Main search function - calls backend API
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
    provider = 'auto',
    maxResults = 10,
  } = options;

  if (!query.trim()) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      provider,
      maxResults: maxResults.toString()
    });

    const response = await fetch(`/api/search-books?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.results) {
      return [];
    }
    
    return data.results;
    
  } catch (err) {
    console.error('Book search failed:', err);
    return [];
  }
}

/**
 * Get list of available search sources
 */
export function getAvailableSources(): Array<{ name: string; displayName: string }> {
  return [
    { name: 'auto', displayName: 'אוטומטי' },
    { name: 'simania', displayName: 'סימניה' },
  ];
}

/**
 * Search a specific source by name
 */
export async function searchBySource(
  sourceName: string,
  query: string
): Promise<BookSearchResult[]> {
  return searchBooks(query, { provider: sourceName });
}
