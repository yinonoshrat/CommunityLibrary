import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for book operations
export interface CreateBookData {
  title: string;
  author: string;
  family_id: string;
  status?: string;
  series?: string | null;
  series_number?: number | null;
  isbn?: string | null;
  publish_year?: number | null;
  publisher?: string | null;
  genre?: string;
  age_range?: string | null;
  pages?: number | null;
  description?: string | null;
  cover_image_url?: string | null;
}

export interface UpdateBookData {
  title?: string;
  author?: string;
  series?: string;
  series_number?: number;
  isbn?: string;
  year_published?: number;
  publisher?: string;
  genre?: string;
  age_range?: string;
  pages?: number;
  description?: string;
  cover_image_url?: string;
}

export interface BookResponse {
  id: number;
  title: string;
  author: string;
  [key: string]: any;
}

/**
 * Hook for creating a new book
 * Invalidates: all book queries
 */
export function useCreateBook(
  options?: Omit<UseMutationOptions<BookResponse, Error, CreateBookData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<BookResponse, Error, CreateBookData>({
    mutationFn: async (data: CreateBookData) => {
      console.log('[useCreateBook] Sending data:', data);
      const response = await apiCall<{ book: BookResponse }>('/api/books', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('[useCreateBook] Received response:', response);
      return response.book;
    },
    onSuccess: (_data) => {
      console.log('[useCreateBook] Success, invalidating queries');
      // Invalidate all book queries to reflect the new book
      queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
    },
    ...options,
  });
}

/**
 * Hook for updating an existing book
 * Invalidates: book detail query and all book lists
 */
export function useUpdateBook(
  bookId: number,
  options?: Omit<UseMutationOptions<BookResponse, Error, UpdateBookData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<BookResponse, Error, UpdateBookData>({
    mutationFn: async (data: UpdateBookData) => {
      const response = await apiCall<{ book: BookResponse }>(`/api/books/${bookId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.book;
    },
    onSuccess: () => {
      // Invalidate the specific book's detail
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(bookId)) });
      
      // Invalidate all book lists since the book may appear in filtered views
      queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
    },
    ...options,
  });
}

/**
 * Hook for deleting a book
 * Invalidates: all book queries
 */
export function useDeleteBook(
  options?: Omit<UseMutationOptions<void, Error, number>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (bookId: number) => {
      await apiCall(`/api/books/${bookId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, bookId) => {
      // Remove the specific book from cache
      queryClient.removeQueries({ queryKey: queryKeys.books.detail(String(bookId)) });
      
      // Invalidate all book lists
      queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
      
      // Invalidate loans for this book
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBook(String(bookId)) });
    },
    ...options,
  });
}
