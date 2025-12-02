/**
 * Query Keys Factory
 * 
 * Centralized query keys for React Query.
 * Using factory pattern to ensure consistent, type-safe query keys.
 * 
 * Benefits:
 * - Easy invalidation of related queries
 * - Type safety
 * - Prevents key collisions
 * - Clear dependencies
 */

export const queryKeys = {
  // User queries
  users: {
    all: ['users'] as const,
    detail: (userId: string) => ['users', userId] as const,
    family: (userId: string) => ['users', userId, 'family'] as const,
  },

  // Book queries
  books: {
    all: ['books'] as const,
    normalized: () => ['books', 'normalized'] as const, // Single normalized cache
    lists: () => ['books', 'list'] as const,
    list: (filters: Record<string, any>) => ['books', 'list', filters] as const,
    details: () => ['books', 'detail'] as const,
    detail: (bookId: string) => ['books', 'detail', bookId] as const,
    search: (query: string) => ['books', 'search', query] as const,
    suggestions: (query: string) => ['books', 'suggestions', query] as const,
  },

  // Loan queries
  loans: {
    all: ['loans'] as const,
    lists: () => ['loans', 'list'] as const,
    byOwner: (familyId: string, status?: string) => 
      ['loans', 'owner', familyId, status] as const,
    byBorrower: (familyId: string, status?: string) => 
      ['loans', 'borrower', familyId, status] as const,
    byBook: (bookId: string, status?: string) => 
      ['loans', 'book', bookId, status] as const,
    detail: (loanId: string) => ['loans', 'detail', loanId] as const,
  },

  // Family queries
  families: {
    all: ['families'] as const,
    lists: () => ['families', 'list'] as const,
    detail: (familyId: string) => ['families', 'detail', familyId] as const,
    members: (familyId: string) => ['families', familyId, 'members'] as const,
    availability: (bookId: string) => ['families', 'availability', bookId] as const,
  },

  // Review queries
  reviews: {
    all: ['reviews'] as const,
    byBook: (bookId: string) => ['reviews', 'book', bookId] as const,
    detail: (reviewId: string) => ['reviews', 'detail', reviewId] as const,
  },

  // Like queries
  likes: {
    byBook: (bookId: string) => ['likes', 'book', bookId] as const,
    byReview: (reviewId: string) => ['likes', 'review', reviewId] as const,
    userLike: (bookId: string, userId: string) => 
      ['likes', 'book', bookId, 'user', userId] as const,
  },

  // Recommendations
  recommendations: {
    all: ['recommendations'] as const,
    forUser: (userId: string) => ['recommendations', 'user', userId] as const,
  },
}

// Helper type to extract query key from factory
// TODO: Fix this type helper - currently causing index signature errors
// export type QueryKey = ReturnType<typeof queryKeys[keyof typeof queryKeys][keyof any]>
