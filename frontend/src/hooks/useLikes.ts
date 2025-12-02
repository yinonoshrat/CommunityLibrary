import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for like operations
export interface Like {
  like_id: number;
  review_id: number;
  user_id: number;
  created_at: string;
}

export interface ReviewLikesData {
  review_id: number;
  likes_count: number;
  user_has_liked: boolean;
}

/**
 * Hook to fetch likes for a specific review
 */
export function useReviewLikes(
  reviewId: number | null | undefined,
  options?: Omit<UseQueryOptions<ReviewLikesData, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ReviewLikesData, Error>({
    queryKey: queryKeys.likes.byReview(String(reviewId!)),
    queryFn: async () => {
      const response = await apiCall(`/api/reviews/${reviewId}/likes`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch likes');
      }
      
      return response.json();
    },
    enabled: !!reviewId,
    staleTime: 30 * 1000, // 30 seconds - likes change frequently
    ...options,
  });
}

/**
 * Hook to toggle like on a review (like or unlike)
 * Uses optimistic updates for instant UI feedback
 */
export function useToggleLike(
  options?: Omit<UseMutationOptions<ReviewLikesData, Error, { reviewId: number; bookId: number }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<ReviewLikesData, Error, { reviewId: number; bookId: number }>({
    mutationFn: async ({ reviewId }) => {
      const response = await apiCall(`/api/reviews/${reviewId}/likes`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle like');
      }

      return response.json();
    },
    // Optimistic update for instant UI feedback
    onMutate: async ({ reviewId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.likes.byReview(String(reviewId)) });
      await queryClient.cancelQueries({ queryKey: queryKeys.reviews.byBook(String(reviewId)) });

      // Snapshot the previous value
      const previousLikes = queryClient.getQueryData<ReviewLikesData>(
        queryKeys.likes.byReview(String(reviewId))
      );

      // Optimistically update like count
      if (previousLikes) {
        queryClient.setQueryData<ReviewLikesData>(
          queryKeys.likes.byReview(String(reviewId)),
          {
            ...previousLikes,
            likes_count: previousLikes.user_has_liked
              ? previousLikes.likes_count - 1
              : previousLikes.likes_count + 1,
            user_has_liked: !previousLikes.user_has_liked,
          }
        );
      }

      // Return context with snapshot value
      return { previousLikes };
    },
    // On error, roll back to previous value
    onError: (_err: Error, { reviewId }, context: unknown) => {
      const ctx = context as { previousLikes?: ReviewLikesData };
      if (ctx?.previousLikes) {
        queryClient.setQueryData(
          queryKeys.likes.byReview(String(reviewId)),
          ctx.previousLikes
        );
      }
    },
    // Always refetch after error or success to ensure consistency
    onSettled: (_, __, { reviewId, bookId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likes.byReview(String(reviewId)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byBook(String(bookId)) });
    },
    ...options,
  });
}

/**
 * Hook to unlike a review (DELETE operation)
 * Alternative to toggle if you need explicit unlike
 */
export function useUnlikeReview(
  options?: Omit<UseMutationOptions<void, Error, { reviewId: number; bookId: number }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { reviewId: number; bookId: number }>({
    mutationFn: async ({ reviewId }) => {
      const response = await apiCall(`/api/reviews/${reviewId}/likes`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unlike review');
      }
    },
    // Optimistic update
    onMutate: async ({ reviewId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.likes.byReview(String(reviewId)) });
      
      const previousLikes = queryClient.getQueryData<ReviewLikesData>(
        queryKeys.likes.byReview(String(reviewId))
      );

      if (previousLikes) {
        queryClient.setQueryData<ReviewLikesData>(
          queryKeys.likes.byReview(String(reviewId)),
          {
            ...previousLikes,
            likes_count: Math.max(0, previousLikes.likes_count - 1),
            user_has_liked: false,
          }
        );
      }

      return { previousLikes };
    },
    onError: (_err: Error, { reviewId }, context: unknown) => {
      const ctx = context as { previousLikes?: ReviewLikesData };
      if (ctx?.previousLikes) {
        queryClient.setQueryData(
          queryKeys.likes.byReview(String(reviewId)),
          ctx.previousLikes
        );
      }
    },
    onSettled: (_, __, { reviewId, bookId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likes.byReview(String(reviewId)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byBook(String(bookId)) });
    },
    ...options,
  });
}
