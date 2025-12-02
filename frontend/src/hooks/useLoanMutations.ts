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
  returnDate?: string;
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
 * Invalidates: all loan queries, book detail query
 */
export function useCreateLoan(
  options?: Omit<UseMutationOptions<LoanResponse, Error, CreateLoanData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<LoanResponse, Error, CreateLoanData>({
    mutationFn: async (data: CreateLoanData) => {
      const response = await apiCall('/api/loans', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create loan');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      
      // Invalidate the specific book's detail and loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(data.book_id)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBook(String(data.book_id)) });
      
      // Invalidate owner and borrower family loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byOwner(String(data.owner_family_id)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBorrower(String(data.borrower_family_id)) });
    },
    ...options,
  });
}

/**
 * Hook for updating an existing loan (e.g., returning a book)
 * Invalidates: all loan queries, book detail query
 */
export function useUpdateLoan(
  loanId: number,
  options?: Omit<UseMutationOptions<LoanResponse, Error, UpdateLoanData>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<LoanResponse, Error, UpdateLoanData>({
    mutationFn: async (data: UpdateLoanData) => {
      const response = await apiCall(`/api/loans/${loanId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update loan');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      
      // Invalidate the specific book's detail and loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.books.detail(String(data.book_id)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBook(String(data.book_id)) });
      
      // Invalidate owner and borrower family loan queries
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byOwner(String(data.owner_family_id)) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.byBorrower(String(data.borrower_family_id)) });
    },
    ...options,
  });
}

/**
 * Hook for returning a book
 * Convenience wrapper around useUpdateLoan
 */
export function useReturnBook(
  loanId: number,
  options?: Omit<UseMutationOptions<LoanResponse, Error, void>, 'mutationFn'>
) {
  const updateLoan = useUpdateLoan(loanId);

  return useMutation<LoanResponse, Error, void>({
    mutationFn: async () => {
      return updateLoan.mutateAsync({
        returnDate: new Date().toISOString(),
        status: 'returned',
      });
    },
    ...options,
  });
}
