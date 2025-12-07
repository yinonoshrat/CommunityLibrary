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
  
  // Update byId with new/updated books
  books.forEach(book => {
    cache.byId[book.catalogId] = book;
  });
  
  // Track which books belong to this query
  cache.queriesData[queryKey] = books.map(b => b.catalogId);
  
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
 * Filter books from normalized cache based on search filters
 * Used for instant client-side filtering while waiting for server response
 */
function filterBooksFromCache(
  queryClient: any,
  filters: BookSearchParams
): CatalogBook[] | undefined {
  const cache = getNormalizedCache(queryClient);
  const allBooks = Object.values(cache.byId);
  
  if (allBooks.length === 0) return undefined;
  
  let filtered = allBooks;
  
  // Filter by search query (title, author, series)
  if (filters.q && filters.q.trim()) {
    const query = filters.q.trim().toLowerCase();
    filtered = filtered.filter(book => {
      const title = (book.titleHebrew || book.title || '').toLowerCase();
      const author = (book.authorHebrew || book.author || '').toLowerCase();
      const series = (book.series || '').toLowerCase();
      return title.includes(query) || author.includes(query) || series.includes(query);
    });
  }
  
  // Filter by view (my/borrowed/all)
  if (filters.view === 'my') {
    filtered = filtered.filter(book => book.viewerContext?.owns);
  } else if (filters.view === 'borrowed') {
    filtered = filtered.filter(book => book.viewerContext?.borrowed);
  }
  
  // Filter by status (available/on_loan)
  if (filters.status === 'available') {
    filtered = filtered.filter(book => (book.stats?.availableCopies || 0) > 0);
  } else if (filters.status === 'on_loan') {
    filtered = filtered.filter(book => (book.stats?.onLoanCopies || 0) > 0);
  }
  
  // Filter by genre
  if (filters.genre && filters.genre !== 'all') {
    filtered = filtered.filter(book => book.genre === filters.genre);
  }
  
  // Filter by age level
  if (filters.ageLevel && filters.ageLevel !== 'all') {
    filtered = filtered.filter(book => book.ageRange === filters.ageLevel);
  }
  
  // Sort books
  if (filters.sortBy === 'author') {
    filtered.sort((a, b) => (a.authorHebrew || a.author || '').localeCompare(b.authorHebrew || b.author || ''));
  } else if (filters.sortBy === 'updated') {
    // CatalogBook doesn't have updated_at, sort by title instead
    filtered.sort((a, b) => (a.titleHebrew || a.title || '').localeCompare(b.titleHebrew || b.title || ''));
  } else {
    // Default: sort by title
    filtered.sort((a, b) => (a.titleHebrew || a.title || '').localeCompare(b.titleHebrew || b.title || ''));
  }
  
  return filtered;
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
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await apiCall<BooksResponse>(`/api/books?${params.toString()}`);
      
      // Update normalized cache
      updateNormalizedCache(queryClient, response.books, queryKey);
      
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
    placeholderData: () => {
      // First try exact query match from cache
      const exactMatch = getBooksFromCache(queryClient, queryKey);
      if (exactMatch) return { books: exactMatch };
      
      // If no exact match, filter all cached books client-side
      // This provides instant results while fetching fresh data from server
      const filteredBooks = filterBooksFromCache(queryClient, filters);
      return filteredBooks ? { books: filteredBooks } : undefined;
    },
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
      // Note: Individual book details use book_catalog_id, not catalogId
      if (response.book && response.book.book_catalog_id) {
        const cache = getNormalizedCache(queryClient);
        cache.byId[response.book.book_catalog_id] = response.book as any;
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
