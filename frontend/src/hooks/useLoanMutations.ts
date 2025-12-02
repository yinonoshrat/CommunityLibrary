import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for loan operations
export interface CreateLoanData {
  family_book_id: string;
  borrower_family_id: string;
  owner_family_id: string;
  requester_user_id: string;
  notes?: string | null;
}

export interface UpdateLoanData {
  return_date?: string;
  status?: 'active' | 'returned' | 'overdue';
}

export interface LoanResponse {
  loan_id: number;
  book_id: number;
  owner_family_id: number;
  borrower_family_id: number;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
}

/**
 * Hook for creating a new loan
 * Uses optimistic updates for instant UI feedback
 */
export function useCreateLoan(
  options?: Omit<UseMutationOptions<LoanResponse, Error, CreateLoanData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<LoanResponse, Error, CreateLoanData>({
    mutationFn: async (data: CreateLoanData) => {
      return apiCall<LoanResponse>('/api/loans', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.books.lists() });
      
      // Get normalized cache
      const normalizedCacheKey = ['books', 'normalized'];
      const cache = queryClient.getQueryData<any>(normalizedCacheKey);
      
      // If no cache exists yet, skip optimistic update
      if (!cache || !cache.byId) {
        return { previousCache: null };
      }
      
      // Snapshot for rollback
      const previousCache = JSON.parse(JSON.stringify(cache));
      
      // Find the book that contains this family_book_id in its ownedCopies
      let targetCatalogId: string | null = null;
      let oldBook: any = null;
      
      if (cache.byId) {
        for (const [catalogId, book] of Object.entries(cache.byId)) {
          const hasOwnedCopy = (book as any).viewerContext?.ownedCopies?.some(
            (copy: any) => copy.familyBookId === variables.family_book_id
          );
          if (hasOwnedCopy) {
            targetCatalogId = catalogId;
            oldBook = book;
            break;
          }
        }
      }
      
      if (oldBook && targetCatalogId) {
        // Try to get the borrower family name from families cache
        const familiesQueryData = queryClient.getQueriesData({ queryKey: ['families'] });
        
        let borrowerFamilyName: string | undefined;
        
        // Check all families queries for the borrower family
        for (const [, data] of familiesQueryData) {
          if (Array.isArray(data)) {
            // Direct array of families
            const family = data.find((f: any) => String(f.id) === variables.borrower_family_id);
            if (family?.name) {
              borrowerFamilyName = family.name;
              break;
            }
          } else if (data && typeof data === 'object' && 'families' in data) {
            // Wrapped in families property
            const families = (data as any).families;
            if (Array.isArray(families)) {
              const family = families.find((f: any) => String(f.id) === variables.borrower_family_id);
              if (family?.name) {
                borrowerFamilyName = family.name;
                break;
              }
            }
          }
        }
        
        // Create new book object with updated loan info
        const updatedBook = {
          ...oldBook,
          viewerContext: {
            ...oldBook.viewerContext,
            ownedCopies: oldBook.viewerContext?.ownedCopies?.map((copy: any) => {
              if (copy.familyBookId === variables.family_book_id) {
                return {
                  ...copy,
                  loan: {
                    id: 'temp-' + Date.now(),
                    borrowerFamily: { 
                      id: variables.borrower_family_id, 
                      name: borrowerFamilyName || 'טוען...'
                    },
                    status: 'active',
                    loanDate: new Date().toISOString(),
                    dueDate: null,
                  }
                };
              }
              return copy;
            }) || []
          },
          stats: {
            ...oldBook.stats,
            availableCopies: Math.max(0, (oldBook.stats?.availableCopies || 0) - 1)
          }
        };
        
        // Update normalized cache with new book object
        const newCache = {
          ...cache,
          byId: {
            ...cache.byId,
            [targetCatalogId]: updatedBook
          }
        };
        queryClient.setQueryData(normalizedCacheKey, newCache);
        
        // Update all book list queries to trigger re-render
        const queries = queryClient.getQueriesData({ queryKey: ['books', 'list'] });
        
        queries.forEach(([queryKey, data]: [any, any]) => {
          if (data?.books) {
            const updatedBooks = data.books.map((b: any) => 
              b.catalogId === targetCatalogId ? updatedBook : b
            );
            queryClient.setQueryData(queryKey, { ...data, books: updatedBooks });
          }
        });
      }
      
      return { previousCache };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCache) {
        queryClient.setQueryData(['books', 'normalized'], context.previousCache);
        queryClient.invalidateQueries({ queryKey: queryKeys.books.lists() });
      }
    },
    onSuccess: (data) => {
      // Invalidate loan-specific queries only
      // Don't invalidate book queries - optimistic update already handles that
      // Books will refresh naturally after staleTime (5 minutes) or manual refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      
      // Invalidate the specific book's loan queries
      if (data.family_book_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBook(String(data.family_book_id)) });
      }
      
      // Invalidate owner and borrower family loan queries
      if (data.owner_family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byOwner(String(data.owner_family_id)) });
      }
      if (data.borrower_family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBorrower(String(data.borrower_family_id)) });
      }
    },
    ...options,
  });
}

/**
 * Hook for updating an existing loan (e.g., returning a book)
 * Uses optimistic updates for instant UI feedback
 */
export function useUpdateLoan(
  loanId: string,
  familyBookId?: string,
  options?: Omit<UseMutationOptions<LoanResponse, Error, UpdateLoanData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<LoanResponse, Error, UpdateLoanData>({
    mutationFn: async (data: UpdateLoanData) => {
      return apiCall<LoanResponse>(`/api/loans/${loanId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.books.lists() });
      
      // Get normalized cache
      const normalizedCacheKey = ['books', 'normalized'];
      const cache = queryClient.getQueryData<any>(normalizedCacheKey);
      
      // If no cache exists yet, skip optimistic update
      if (!cache || !cache.byId) {
        return { previousCache: null };
      }
      
      // Snapshot for rollback
      const previousCache = JSON.parse(JSON.stringify(cache));
      
      // Find the book that contains this familyBookId in its ownedCopies
      let targetCatalogId: string | null = null;
      let oldBook: any = null;
      
      if (variables.status === 'returned' && familyBookId && cache.byId) {
        for (const [catalogId, book] of Object.entries(cache.byId)) {
          const hasOwnedCopy = (book as any).viewerContext?.ownedCopies?.some(
            (copy: any) => copy.familyBookId === familyBookId
          );
          if (hasOwnedCopy) {
            targetCatalogId = catalogId;
            oldBook = book;
            break;
          }
        }
      }
      
      if (oldBook && targetCatalogId) {
        // Create new book object with loan removed
        const updatedBook = {
          ...oldBook,
          viewerContext: {
            ...oldBook.viewerContext,
            ownedCopies: oldBook.viewerContext?.ownedCopies?.map((copy: any) => {
              if (copy.familyBookId === familyBookId) {
                return {
                  ...copy,
                  loan: null
                };
              }
              return copy;
            }) || []
          },
          stats: {
            ...oldBook.stats,
            availableCopies: (oldBook.stats?.availableCopies || 0) + 1
          }
        };
        
        // Update normalized cache with new book object
        const newCache = {
          ...cache,
          byId: {
            ...cache.byId,
            [targetCatalogId]: updatedBook
          }
        };
        queryClient.setQueryData(normalizedCacheKey, newCache);
        
        // Update all book list queries to trigger re-render
        const queries = queryClient.getQueriesData({ queryKey: ['books', 'list'] });
        
        queries.forEach(([queryKey, data]: [any, any]) => {
          if (data?.books) {
            const updatedBooks = data.books.map((b: any) => 
              b.catalogId === targetCatalogId ? updatedBook : b
            );
            queryClient.setQueryData(queryKey, { ...data, books: updatedBooks });
          }
        });
      }
      
      return { previousCache };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCache) {
        queryClient.setQueryData(['books', 'normalized'], context.previousCache);
        queryClient.invalidateQueries({ queryKey: queryKeys.books.lists() });
      }
    },
    onSuccess: (data) => {
      // Invalidate loan-specific queries only
      // Don't invalidate book queries - optimistic update already handles that
      // Books will refresh naturally after staleTime (5 minutes) or manual refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      
      // Invalidate the specific book's loan queries
      if (data.family_book_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBook(String(data.family_book_id)) });
      }
      
      // Invalidate owner and borrower family loan queries
      if (data.owner_family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byOwner(String(data.owner_family_id)) });
      }
      if (data.borrower_family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBorrower(String(data.borrower_family_id)) });
      }
    },
    ...options,
  });
}

/**
 * Hook for returning a book
 * Convenience wrapper around useUpdateLoan with optimistic updates
 */
export function useReturnBook(
  loanId: string,
  familyBookId?: string,
  options?: Omit<UseMutationOptions<LoanResponse, Error, void>, 'mutationFn'>
) {
  const updateLoan = useUpdateLoan(loanId, familyBookId);

  return useMutation<LoanResponse, Error, void>({
    mutationFn: async () => {
      return updateLoan.mutateAsync({
        return_date: new Date().toISOString(),
        status: 'returned',
      });
    },
    ...options,
  });
}
