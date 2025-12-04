import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for loan operations
export interface CreateLoanData {
  id?: string; // Optional - will be generated on frontend if not provided
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

export interface LoanData {
  id: string;
  family_book_id: string;
  owner_family_id: string;
  borrower_family_id: string;
  loan_date: string;
  due_date: string | null;
  return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
  borrower_family?: {
    id: string;
    name: string;
    phone?: string;
    whatsapp?: string;
  };
  owner_family?: {
    id: string;
    name: string;
    phone?: string;
    whatsapp?: string;
  };
  created_at?: string;
}

export interface LoanResponse {
  loan: LoanData;
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
      // Use the UUID provided by the caller (should always be provided now)
      if (!data.id) {
        console.error('[useCreateLoan.mutationFn] ERROR: No loan ID provided! This should not happen.');
      }
      const loanId = data.id || crypto.randomUUID(); // Fallback just in case
      console.log('[useCreateLoan.mutationFn] Using loan ID:', loanId, 'family_book_id:', data.family_book_id);
      
      return apiCall<LoanResponse>('/api/loans', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          id: loanId,
        }),
      });
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.books.lists() });
      await queryClient.cancelQueries({ queryKey: ['books', 'normalized'] });
      
      // Use the loan ID provided by the caller (should always be provided now)
      if (!variables.id) {
        console.error('[useCreateLoan.onMutate] ERROR: No loan ID provided! This should not happen.');
      }
      const loanId = variables.id || crypto.randomUUID(); // Fallback just in case
      console.log('[useCreateLoan.onMutate] Using loan ID:', loanId, 'family_book_id:', variables.family_book_id);
      
      // Get normalized cache
      const normalizedCacheKey = ['books', 'normalized'];
      const cache = queryClient.getQueryData<any>(normalizedCacheKey);
      
      // If no cache exists yet, skip optimistic update
      if (!cache || !cache.byId) {
        return { previousCache: null, targetCatalogId: null, familyBookId: variables.family_book_id, loanId };
      }
      
      // Snapshot for rollback
      const previousCache = JSON.parse(JSON.stringify(cache));
      
      // Find the book that contains this family_book_id in its ownedCopies
      let targetCatalogId: string | null = null;
      let oldBook: any = null;
      
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
      
      if (oldBook && targetCatalogId) {
        // Get borrower family name from families cache
        const familiesQueryData = queryClient.getQueriesData({ queryKey: ['families'] });
        let borrowerFamilyName: string | undefined;
        
        for (const [, data] of familiesQueryData) {
          if (Array.isArray(data)) {
            const family = data.find((f: any) => String(f.id) === variables.borrower_family_id);
            if (family?.name) {
              borrowerFamilyName = family.name;
              break;
            }
          }
        }
        
        // Use real UUID (same one being sent to server)
        const optimisticLoanId = loanId;
        console.log('[useCreateLoan.onMutate] Creating optimistic loan with ID:', optimisticLoanId);
        
        // Create new book object with optimistic loan (using real UUID)
        const updatedBook = {
          ...oldBook,
          viewerContext: {
            ...oldBook.viewerContext,
            ownedCopies: oldBook.viewerContext?.ownedCopies?.map((copy: any) => {
              if (copy.familyBookId === variables.family_book_id) {
                return {
                  ...copy,
                  loan: {
                    id: optimisticLoanId, // Real UUID that matches server
                    familyBookId: variables.family_book_id,
                    borrowerFamilyId: variables.borrower_family_id,
                    ownerFamilyId: variables.owner_family_id,
                    borrowerFamily: { 
                      id: variables.borrower_family_id, 
                      name: borrowerFamilyName || 'טוען...'
                    },
                    status: 'active' as const,
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
        
        // Update normalized cache
        const newCache = {
          ...cache,
          byId: {
            ...cache.byId,
            [targetCatalogId]: updatedBook
          }
        };
        console.log('[useCreateLoan.onMutate] Saving to normalized cache, loan ID:', 
          newCache.byId[targetCatalogId]?.viewerContext?.ownedCopies?.find((c: any) => c.familyBookId === variables.family_book_id)?.loan?.id
        );
        queryClient.setQueryData(normalizedCacheKey, newCache);
        
        // Update all book list queries
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
      
      return { previousCache, targetCatalogId, familyBookId: variables.family_book_id, loanId };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCache) {
        queryClient.setQueryData(['books', 'normalized'], context.previousCache);
        
        // Update all list queries to reflect rollback
        const queries = queryClient.getQueriesData({ queryKey: ['books', 'list'] });
        queries.forEach(([queryKey, data]: [any, any]) => {
          if (data?.books && context.targetCatalogId) {
            const rolledBackBook = context.previousCache.byId[context.targetCatalogId];
            if (rolledBackBook) {
              const updatedBooks = data.books.map((b: any) => 
                b.catalogId === context.targetCatalogId ? rolledBackBook : b
              );
              queryClient.setQueryData(queryKey, { ...data, books: updatedBooks });
            }
          }
        });
      }
    },
    onSuccess: (responseData, variables, context) => {
      // Validate server response
      if (!responseData?.loan?.id) {
        console.error('Invalid loan response:', responseData);
        return;
      }
      
      const serverLoan = responseData.loan;
      
      // Verify the server used our UUID
      console.log('[useCreateLoan.onSuccess] Server response:', {
        serverLoanId: serverLoan.id,
        contextLoanId: context?.loanId,
        familyBookId: variables.family_book_id,
        match: serverLoan.id === context?.loanId
      });
      
      if (context?.loanId && serverLoan.id !== context.loanId) {
        console.warn('Server returned different loan ID than expected:', {
          expected: context.loanId,
          received: serverLoan.id
        });
      }
      
      // Get current cache
      const normalizedCacheKey = ['books', 'normalized'];
      const cache = queryClient.getQueryData<any>(normalizedCacheKey);
      
      if (!cache?.byId || !context?.targetCatalogId) {
        return;
      }
      
      const currentBook = cache.byId[context.targetCatalogId];
      if (!currentBook) return;
      
      // Enrich optimistic loan with additional server data
      // The loan ID is already correct, just add server-provided fields
      console.log('[useCreateLoan.onSuccess] Current copy loan before enrichment:', 
        currentBook.viewerContext?.ownedCopies?.find((c: any) => c.familyBookId === variables.family_book_id)?.loan
      );
      
      const updatedBook = {
        ...currentBook,
        viewerContext: {
          ...currentBook.viewerContext,
          ownedCopies: currentBook.viewerContext?.ownedCopies?.map((copy: any) => {
            if (copy.familyBookId === variables.family_book_id) {
              const enrichedLoan = {
                ...copy.loan, // Keep existing data (ID is already correct)
                id: serverLoan.id, // EXPLICITLY set server ID to be safe
                // Enrich with server data
                borrowerFamily: serverLoan.borrower_family || copy.loan?.borrowerFamily,
                ownerFamily: serverLoan.owner_family,
                loanDate: serverLoan.loan_date || serverLoan.created_at || copy.loan?.loanDate,
                dueDate: serverLoan.due_date || copy.loan?.dueDate,
              };
              console.log('[useCreateLoan.onSuccess] Enriched loan:', enrichedLoan);
              return {
                ...copy,
                loan: enrichedLoan
              };
            }
            return copy;
          }) || []
        }
      };
      
      // Update normalized cache with enriched data
      const newCache = {
        ...cache,
        byId: {
          ...cache.byId,
          [context.targetCatalogId]: updatedBook
        }
      };
      queryClient.setQueryData(normalizedCacheKey, newCache);
      console.log('[useCreateLoan.onSuccess] Updated normalized cache with loan ID:', 
        newCache.byId[context.targetCatalogId]?.viewerContext?.ownedCopies?.find((c: any) => c.familyBookId === variables.family_book_id)?.loan?.id
      );
      
      // Update all book list queries
      const queries = queryClient.getQueriesData({ queryKey: ['books', 'list'] });
      console.log('[useCreateLoan.onSuccess] Updating', queries.length, 'list queries');
      queries.forEach(([queryKey, data]: [any, any]) => {
        if (data?.books) {
          const updatedBooks = data.books.map((b: any) => 
            b.catalogId === context.targetCatalogId ? updatedBook : b
          );
          queryClient.setQueryData(queryKey, { ...data, books: updatedBooks });
        }
      });
      
      // Invalidate loan queries (but NOT book queries - we already have the right data)
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
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
      await queryClient.cancelQueries({ queryKey: ['books', 'normalized'] });
      
      // Get normalized cache
      const normalizedCacheKey = ['books', 'normalized'];
      const cache = queryClient.getQueryData<any>(normalizedCacheKey);
      
      // If no cache exists yet, skip optimistic update
      if (!cache || !cache.byId) {
        return { previousCache: null, targetCatalogId: null };
      }
      
      // Snapshot for rollback
      const previousCache = JSON.parse(JSON.stringify(cache));
      
      // Find the book that contains this familyBookId in its ownedCopies
      let targetCatalogId: string | null = null;
      let oldBook: any = null;
      
      if (variables.status === 'returned' && familyBookId) {
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
        // Create new book object with loan removed (optimistic)
        const updatedBook = {
          ...oldBook,
          viewerContext: {
            ...oldBook.viewerContext,
            ownedCopies: oldBook.viewerContext?.ownedCopies?.map((copy: any) => {
              if (copy.familyBookId === familyBookId) {
                return {
                  ...copy,
                  loan: null  // Remove loan optimistically
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
        
        // Update normalized cache
        const newCache = {
          ...cache,
          byId: {
            ...cache.byId,
            [targetCatalogId]: updatedBook
          }
        };
        queryClient.setQueryData(normalizedCacheKey, newCache);
        
        // Update all book list queries
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
      
      return { previousCache, targetCatalogId };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCache) {
        queryClient.setQueryData(['books', 'normalized'], context.previousCache);
        
        // Update all list queries to reflect rollback
        const queries = queryClient.getQueriesData({ queryKey: ['books', 'list'] });
        queries.forEach(([queryKey, data]: [any, any]) => {
          if (data?.books && context.targetCatalogId) {
            const rolledBackBook = context.previousCache.byId[context.targetCatalogId];
            if (rolledBackBook) {
              const updatedBooks = data.books.map((b: any) => 
                b.catalogId === context.targetCatalogId ? rolledBackBook : b
              );
              queryClient.setQueryData(queryKey, { ...data, books: updatedBooks });
            }
          }
        });
      }
    },
    onSuccess: (responseData, _variables, context) => {
      // Server confirms the return - loan is gone, book is available
      // Cache already updated optimistically, just confirm it's correct
      // If server returned different data, we'd update here, but for return
      // the optimistic update (loan removed, availableCopies +1) is final
      
      // Invalidate loan queries only
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
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
