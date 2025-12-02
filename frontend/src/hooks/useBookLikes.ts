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
 * Uses optimistic updates for instant UI feedback
 * Invalidates books queries to update embedded like data
 */
export function useToggleBookLike(
  bookId: string,
  userId: string | undefined,
  options?: Omit<UseMutationOptions<ToggleLikeResponse, Error, void>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<ToggleLikeResponse, Error, void>({
    mutationFn: async () => {
      const response = await apiCall(`/api/books/${bookId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      return response;
    },
    // Optimistic update - update book stats directly in ALL cached books queries
    onMutate: async () => {
      // Cancel any outgoing refetches for books
      await queryClient.cancelQueries({ queryKey: queryKeys.books.all });
      
      // Also cancel the specific book detail query
      await queryClient.cancelQueries({ queryKey: queryKeys.books.detail(bookId) });

      // Snapshot all books queries
      const previousQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.books.all });
      const previousBookDetail = queryClient.getQueryData(queryKeys.books.detail(bookId));

      // Optimistically update all books queries that contain this book
      queryClient.setQueriesData({ queryKey: queryKeys.books.all }, (oldData: any) => {
        if (!oldData || !userId) return oldData;

        // Handle BooksResponse with books array
        if (oldData.books && Array.isArray(oldData.books)) {
          return {
            ...oldData,
            books: oldData.books.map((book: any) => {
              if (book.catalogId === bookId) {
                const currentLiked = book.stats?.userLiked || false;
                return {
                  ...book,
                  stats: {
                    ...book.stats,
                    totalLikes: currentLiked
                      ? Math.max(0, (book.stats?.totalLikes || 0) - 1)
                      : (book.stats?.totalLikes || 0) + 1,
                    userLiked: !currentLiked,
                  },
                };
              }
              return book;
            }),
          };
        }

        // Handle array of books directly
        if (Array.isArray(oldData)) {
          return oldData.map((book) => {
            if (book.catalogId === bookId) {
              const currentLiked = book.stats?.userLiked || false;
              return {
                ...book,
                stats: {
                  ...book.stats,
                  totalLikes: currentLiked
                    ? Math.max(0, (book.stats?.totalLikes || 0) - 1)
                    : (book.stats?.totalLikes || 0) + 1,
                  userLiked: !currentLiked,
                },
              };
            }
            return book;
          });
        }

        // Handle BookResponse with single book (from /api/books/:id)
        if (oldData.book && oldData.book.catalogId === bookId) {
          const currentLiked = oldData.book.stats?.userLiked || false;
          return {
            ...oldData,
            book: {
              ...oldData.book,
              stats: {
                ...oldData.book.stats,
                totalLikes: currentLiked
                  ? Math.max(0, (oldData.book.stats?.totalLikes || 0) - 1)
                  : (oldData.book.stats?.totalLikes || 0) + 1,
                userLiked: !currentLiked,
              },
            },
          };
        }

        return oldData;
      });

      // Also update the specific book detail query cache
      queryClient.setQueryData(queryKeys.books.detail(bookId), (oldData: any) => {
        if (!oldData || !userId) return oldData;

        // Handle BookResponse format
        if (oldData.book && oldData.book.catalogId === bookId) {
          const currentLiked = oldData.book.stats?.userLiked || false;
          return {
            ...oldData,
            book: {
              ...oldData.book,
              stats: {
                ...oldData.book.stats,
                totalLikes: currentLiked
                  ? Math.max(0, (oldData.book.stats?.totalLikes || 0) - 1)
                  : (oldData.book.stats?.totalLikes || 0) + 1,
                userLiked: !currentLiked,
              },
            },
          };
        }

        return oldData;
      });

      // Return context with snapshot values for rollback on error only
      return { previousQueries, previousBookDetail };
    },
    // On error, roll back to previous values
    onError: (_err: Error, _variables: void, context: unknown) => {
      const ctx = context as { previousQueries?: [any, any][]; previousBookDetail?: any };
      if (ctx?.previousQueries) {
        ctx.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (ctx?.previousBookDetail !== undefined) {
        queryClient.setQueryData(queryKeys.books.detail(bookId), ctx.previousBookDetail);
      }
    },
    // On success, update cache with server response to ensure consistency
    onSuccess: (data) => {
      console.log('[useToggleBookLike] Server response:', data);
      console.log('[useToggleBookLike] Updating all book caches for bookId:', bookId);
      
      // Get all book queries to see what's in cache
      const allBookQueries = queryClient.getQueriesData({ queryKey: queryKeys.books.all });
      console.log('[useToggleBookLike] Found book queries in cache:', allBookQueries.length);
      
      // Update all books queries with the actual server data
      queryClient.setQueriesData({ queryKey: queryKeys.books.all }, (oldData: any) => {
        if (!oldData) return oldData;

        // Handle BooksResponse with books array
        if (oldData.books && Array.isArray(oldData.books)) {
          const bookFound = oldData.books.some((book: any) => book.catalogId === bookId);
          console.log('[useToggleBookLike] Updating BooksResponse, book found:', bookFound);
          
          return {
            ...oldData,
            books: oldData.books.map((book: any) => {
              if (book.catalogId === bookId) {
                return {
                  ...book,
                  stats: {
                    ...book.stats,
                    totalLikes: data.count,
                    userLiked: data.liked,
                  },
                };
              }
              return book;
            }),
          };
        }

        // Handle array of books directly
        if (Array.isArray(oldData)) {
          const bookFound = oldData.some((book) => book.catalogId === bookId);
          console.log('[useToggleBookLike] Updating books array, book found:', bookFound);
          
          return oldData.map((book) => {
            if (book.catalogId === bookId) {
              return {
                ...book,
                stats: {
                  ...book.stats,
                  totalLikes: data.count,
                  userLiked: data.liked,
                },
              };
            }
            return book;
          });
        }

        // Handle BookResponse with single book
        if (oldData.book && oldData.book.catalogId === bookId) {
          console.log('[useToggleBookLike] Updating BookResponse');
          
          return {
            ...oldData,
            book: {
              ...oldData.book,
              stats: {
                ...oldData.book.stats,
                totalLikes: data.count,
                userLiked: data.liked,
              },
            },
          };
        }

        return oldData;
      });

      // Also update the specific book detail query
      queryClient.setQueryData(queryKeys.books.detail(bookId), (oldData: any) => {
        if (!oldData) return oldData;

        if (oldData.book && oldData.book.catalogId === bookId) {
          console.log('[useToggleBookLike] Updated book detail cache');
          
          return {
            ...oldData,
            book: {
              ...oldData.book,
              stats: {
                ...oldData.book.stats,
                totalLikes: data.count,
                userLiked: data.liked,
              },
            },
          };
        }

        return oldData;
      });
      
      console.log('[useToggleBookLike] Cache update complete');
    },
    ...options,
  });
}
