import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// TypeScript interfaces
interface Loan {
  id: string;
  family_book_id: string;
  borrower_family_id: string;
  owner_family_id: string;
  requester_user_id: string;
  status: 'active' | 'returned';
  request_date: string;
  actual_return_date?: string;
  notes?: string;
  family_books?: any;
  books?: any;
  borrower_family?: any;
}

interface LoansResponse {
  loans: Loan[];
}

/**
 * Fetch loans by owner family
 * Used to see books you've lent out
 */
export function useLoansByOwner(
  familyId: string | undefined,
  status?: 'active' | 'returned',
  options?: Omit<UseQueryOptions<LoansResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.loans.byOwner(familyId!, status),
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('ownerFamilyId', familyId!);
      if (status) params.append('status', status);
      return apiCall<LoansResponse>(`/api/loans?${params.toString()}`);
    },
    enabled: !!familyId,
    staleTime: 30 * 1000, // Loan data stays fresh for 30 seconds
    ...options,
  });
}

/**
 * Fetch loans by borrower family
 * Used to see books you've borrowed from others
 */
export function useLoansByBorrower(
  familyId: string | undefined,
  status?: 'active' | 'returned',
  options?: Omit<UseQueryOptions<LoansResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.loans.byBorrower(familyId!, status),
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('borrowerFamilyId', familyId!);
      if (status) params.append('status', status);
      return apiCall<LoansResponse>(`/api/loans?${params.toString()}`);
    },
    enabled: !!familyId,
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * Fetch loans for a specific book
 * Used to check if a book is currently on loan
 */
export function useLoansByBook(
  bookId: string | undefined,
  status?: 'active' | 'returned',
  options?: Omit<UseQueryOptions<LoansResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.loans.byBook(bookId!, status),
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('bookId', bookId!);
      if (status) params.append('status', status);
      return apiCall<LoansResponse>(`/api/loans?${params.toString()}`);
    },
    enabled: !!bookId,
    staleTime: 30 * 1000,
    ...options,
  });
}
