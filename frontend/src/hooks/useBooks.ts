import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
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

/**
 * Fetch books with filters
 * Each unique combination of filters gets its own cache entry
 */
export function useBooks(
  filters: BookSearchParams = {},
  options?: Omit<UseQueryOptions<BooksResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.books.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
      return apiCall<BooksResponse>(`/api/books?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Fetch single book details
 */
export function useBook(
  bookId: string | number | null | undefined,
  userId?: string,
  options?: Omit<UseQueryOptions<BookResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.books.detail(String(bookId)),
    queryFn: () => {
      const params = userId ? `?user_id=${userId}` : '';
      return apiCall<BookResponse>(`/api/books/${bookId}${params}`);
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
