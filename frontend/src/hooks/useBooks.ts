import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';
import type { CatalogBook } from '../types';

// TypeScript interfaces
interface BookSearchParams {
  familyId?: string;
  view?: 'all' | 'my' | 'borrowed';
  status?: 'all' | 'available' | 'on_loan';
  q?: string;
  genre?: string;
  ageLevel?: string;
  userId?: string;
  sortBy?: string;
}

interface BooksResponse {
  books: CatalogBook[];
  meta?: {
    message?: string;
  };
}

interface BookResponse {
  book: any;
}

interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  cover_image_url?: string;
}

interface BookSearchResponse {
  books: BookSuggestion[];
}

// Normalized book cache - store all books by ID
interface NormalizedBooksCache {
  byId: Record<string, CatalogBook>;
  queriesData: Record<string, string[]>; // Track which books belong to which query
}

/**
 * Get or initialize the normalized books cache
 */
function getNormalizedCache(queryClient: any): NormalizedBooksCache {
  const existing = queryClient.getQueryData(queryKeys.books.normalized()) as NormalizedBooksCache | undefined;
  if (existing) return existing;
  
  const initial: NormalizedBooksCache = { byId: {}, queriesData: {} };
  queryClient.setQueryData(queryKeys.books.normalized(), initial);
  return initial;
}

/**
 * Update normalized cache with new books
 */
function updateNormalizedCache(
  queryClient: any,
  books: CatalogBook[],
  queryKey: string
) {
  const cache = getNormalizedCache(queryClient);
  
  console.log('[updateNormalizedCache] Updating cache with', books.length, 'books');
  
  // Update byId with new/updated books
  books.forEach(book => {
    console.log('[updateNormalizedCache] Adding book:', book.catalogId, book.title || book.titleHebrew);
    cache.byId[book.catalogId] = book;
  });
  
  // Track which books belong to this query
  cache.queriesData[queryKey] = books.map(b => b.catalogId);
  
  console.log('[updateNormalizedCache] Cache now has', Object.keys(cache.byId).length, 'books');
  console.log('[updateNormalizedCache] Book IDs:', Object.keys(cache.byId));
  
  queryClient.setQueryData(queryKeys.books.normalized(), cache);
}

/**
 * Get books from normalized cache and filter them
 */
function getBooksFromCache(
  queryClient: any,
  queryKey: string
): CatalogBook[] | undefined {
  const cache = getNormalizedCache(queryClient);
  const bookIds = cache.queriesData[queryKey];
  
  if (!bookIds) return undefined;
  
  return bookIds
    .map(id => cache.byId[id])
    .filter(Boolean); // Remove any undefined books
}

/**
 * Fetch books with filters
 * Uses normalized caching - all books stored by ID, queries track which books they contain
 */
export function useBooks(
  filters: BookSearchParams = {},
  options?: Omit<UseQueryOptions<BooksResponse>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();
  const queryKey = JSON.stringify(filters); // Serialize filters for tracking
  
  return useQuery({
    queryKey: queryKeys.books.list(filters),
    queryFn: async () => {
      console.log('[useBooks] Fetching from server with filters:', filters);
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await apiCall<BooksResponse>(`/api/books?${params.toString()}`);
      
      console.log('[useBooks] Got response with', response.books.length, 'books');
      
      // Update normalized cache
      updateNormalizedCache(queryClient, response.books, queryKey);
      
      console.log('[useBooks] Updated normalized cache');
      
      return response;
    },
    // Try to get from normalized cache first
    placeholderData: () => {
      const books = getBooksFromCache(queryClient, queryKey);
      if (books) {
        console.log('[useBooks] Returning', books.length, 'books from normalized cache');
      } else {
        console.log('[useBooks] No data in normalized cache for this query');
      }
      return books ? { books } : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Fetch single book details
 * Also updates the normalized cache
 */
export function useBook(
  bookId: string | number | null | undefined,
  userId?: string,
  options?: Omit<UseQueryOptions<BookResponse>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: queryKeys.books.detail(String(bookId)),
    queryFn: async () => {
      const params = userId ? `?user_id=${userId}` : '';
      const response = await apiCall<BookResponse>(`/api/books/${bookId}${params}`);
      
      // Update normalized cache with this book
      if (response.book) {
        const cache = getNormalizedCache(queryClient);
        cache.byId[response.book.catalogId] = response.book;
        queryClient.setQueryData(queryKeys.books.normalized(), cache);
      }
      
      return response;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Search books (for autocomplete suggestions)
 * Shorter stale time since search results change frequently
 */
export function useBookSearch(
  query: string,
  options?: Omit<UseQueryOptions<BookSearchResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.books.suggestions(query),
    queryFn: () => apiCall<BookSearchResponse>(`/api/books/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2, // Only search if query is 2+ characters
    staleTime: 10 * 1000, // Search results stay fresh for 10 seconds
    ...options,
  });
}
