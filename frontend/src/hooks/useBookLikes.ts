import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for book likes
export interface BookLike {
  like_id: string;
  book_id: string;
  user_id: string;
  created_at: string;
}

export interface BookLikesResponse {
  count: number;
  likes: BookLike[];
}

export interface ToggleLikeResponse {
  liked: boolean;
  count: number;
}

/**
 * Hook to fetch likes for a specific book
 */
export function useBookLikes(
  bookId: string | undefined,
  options?: Omit<UseQueryOptions<BookLikesResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<BookLikesResponse, Error>({
    queryKey: queryKeys.likes.byBook(bookId!),
    queryFn: async () => {
      const response = await apiCall(`/api/books/${bookId}/likes`);
      return response;
    },
    enabled: !!bookId,
    staleTime: 30 * 1000, // 30 seconds - likes change frequently
    ...options,
  });
}

/**
 * Hook to toggle like on a book (like or unlike)
 * Updates the normalized book cache so all queries see the change
 */
export function useToggleBookLike(
  bookId: string,
  userId: string | undefined,
  options?: Omit<UseMutationOptions<ToggleLikeResponse, Error, void>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  
  // Save the user's callbacks
  const userOnSuccess = options?.onSuccess;
  const userOnError = options?.onError;

  return useMutation<ToggleLikeResponse, Error, void>({
    ...options,
    mutationFn: async () => {
      console.log('[useToggleBookLike] Mutation called for bookId:', bookId);
      
      const response = await apiCall(`/api/books/${bookId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      console.log('[useToggleBookLike] API response:', response);
      return response;
    },
    // Merge onSuccess callbacks
    onSuccess: async (data, variables, context) => {
      try {
        console.log('[useToggleBookLike] onSuccess called!');
        console.log('[useToggleBookLike] Server response:', data);
        console.log('[useToggleBookLike] Updating normalized cache for bookId:', bookId);
        
        // Get normalized cache
        const normalizedCacheKey = ['books', 'normalized'];
        const cache = queryClient.getQueryData<any>(normalizedCacheKey);
        
        console.log('[useToggleBookLike] Current normalized cache:', cache);
        
        if (cache && cache.byId && cache.byId[bookId]) {
          console.log('[useToggleBookLike] Found book in cache, current stats:', cache.byId[bookId].stats);
          
          // Update the book in normalized cache
          const updatedBook = {
            ...cache.byId[bookId],
            stats: {
              ...cache.byId[bookId].stats,
              totalLikes: data.count,
              userLiked: data.liked,
            },
          };
          
          cache.byId[bookId] = updatedBook;
          queryClient.setQueryData(normalizedCacheKey, cache);
          
          console.log('[useToggleBookLike] Updated book in normalized cache, new stats:', updatedBook.stats);
          
          // Invalidate all book list queries so they re-fetch from normalized cache
          console.log('[useToggleBookLike] Invalidating book list queries');
          queryClient.invalidateQueries({ queryKey: ['books', 'list'] });
          
          // Also update the specific book detail query if it exists
          const detailKey = ['books', 'detail', bookId];
          const oldDetail = queryClient.getQueryData(detailKey);
          console.log('[useToggleBookLike] Book detail query exists:', !!oldDetail);
          
          queryClient.setQueryData(detailKey, (oldData: any) => {
            if (!oldData) return oldData;
            
            if (oldData.book) {
              console.log('[useToggleBookLike] Updated book detail query');
              return {
                ...oldData,
                book: updatedBook,
              };
            }
            
            return oldData;
          });
        } else {
          console.warn('[useToggleBookLike] Book not found in normalized cache. Cache state:', {
            cacheExists: !!cache,
            hasById: !!(cache && cache.byId),
            bookIds: cache && cache.byId ? Object.keys(cache.byId) : [],
            lookingFor: bookId
          });
        }
      } catch (error) {
        console.error('[useToggleBookLike] Error in onSuccess:', error);
        throw error;
      }
      
      // Call user's onSuccess callback if provided
      if (userOnSuccess) {
        await (userOnSuccess as any)(data, variables, context);
      }
    },
    // Merge onError callbacks  
    onError: async (error, variables, context) => {
      console.error('[useToggleBookLike] Error:', error);
      
      if (userOnError) {
        await (userOnError as any)(error, variables, context);
      }
    },
  });
}
