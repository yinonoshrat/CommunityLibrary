import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for review operations
export interface Review {
  review_id: number;
  book_id: number;
  user_id: number;
  rating: number;
  review_text: string;
  created_at: string;
  user_name?: string;
  likes_count?: number;
  user_has_liked?: boolean;
}

export interface CreateReviewData {
  bookId: number;
  rating: number;
  reviewText: string;
}

/**
 * Hook to fetch reviews for a specific book
 */
export function useReviews(
  bookId: number | null | undefined,
  options?: Omit<UseQueryOptions<Review[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Review[], Error>({
    queryKey: queryKeys.reviews.byBook(String(bookId!)),
    queryFn: async () => {
      const response = await apiCall(`/api/books/${bookId}/reviews`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      
      const data = await response.json();
      return data.reviews || [];
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to create a new review
 * Invalidates: book reviews and book detail (for rating update)
 */
export function useCreateReview(
  options?: Omit<UseMutationOptions<Review, Error, CreateReviewData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<Review, Error, CreateReviewData>({
    mutationFn: async (data: CreateReviewData) => {
      const response = await apiCall(`/api/books/${data.bookId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: data.rating,
          review_text: data.reviewText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create review');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate reviews for this book
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byBook(String(variables.bookId)) });
      
      // Invalidate book detail to update average rating
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(variables.bookId)) });
    },
    ...options,
  });
}

/**
 * Hook to update an existing review
 */
export function useUpdateReview(
  reviewId: number,
  options?: Omit<UseMutationOptions<Review, Error, { rating: number; reviewText: string; bookId: number }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<Review, Error, { rating: number; reviewText: string; bookId: number }>({
    mutationFn: async (data) => {
      const response = await apiCall(`/api/reviews/${reviewId}`, {
        method: 'PUT',
        body: JSON.stringify({
          rating: data.rating,
          review_text: data.reviewText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update review');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byBook(String(variables.bookId)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(variables.bookId)) });
    },
    ...options,
  });
}

/**
 * Hook to delete a review
 */
export function useDeleteReview(
  options?: Omit<UseMutationOptions<void, Error, { reviewId: number; bookId: number }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { reviewId: number; bookId: number }>({
    mutationFn: async ({ reviewId }) => {
      const response = await apiCall(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete review');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byBook(String(variables.bookId)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(variables.bookId)) });
    },
    ...options,
  });
}
