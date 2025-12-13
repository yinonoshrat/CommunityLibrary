/**
 * Book Search Utility
 * 
 * Searches for books using the backend API which supports multiple providers
 */

import { apiCall } from './apiCall';

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
  catalogId?: string;
  alreadyOwned?: boolean;
}

export interface SearchOptions {
  /** Search provider (auto, simania, google) */
  provider?: string;
  /** Maximum number of results to return */
  maxResults?: number;
  /** User ID to check for owned books */
  userId?: string;
  /** Explicit title for structured search */
  title?: string;
  /** Explicit author for structured search */
  author?: string;
}

/**
 * Main search function - calls backend API
 * 
 * @param query - The search query (optional if title is provided in options)
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
    userId,
    title,
    author
  } = options;

  if (!query.trim() && !title) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      provider,
      maxResults: maxResults.toString()
    });

    if (query) params.append('q', query);
    if (title) params.append('title', title);
    if (author) params.append('author', author);
    if (userId) params.append('userId', userId);

    const data = await apiCall<{ success: boolean; results: BookSearchResult[] }>(
      `/api/search-books?${params.toString()}`
    );
    
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
