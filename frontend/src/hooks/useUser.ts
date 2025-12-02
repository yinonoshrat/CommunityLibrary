import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// TypeScript interfaces
interface User {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  family_id: string;
  is_family_admin: boolean;
  created_at: string;
}

interface UserResponse {
  user: User;
}

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
}

interface FamilyResponse {
  family: Family;
}

/**
 * Fetch user profile by ID
 * 
 * This is the HIGHEST PRIORITY hook - called 9+ times across the app:
 * - Home.tsx
 * - Profile.tsx
 * - BookDetails.tsx
 * - AddBook.tsx
 * - LoansDashboard.tsx
 * - CatalogBookCard.tsx
 * - AuthCallback.tsx
 * 
 * Benefits:
 * - Single network request shared across all components
 * - Stale-while-revalidate: shows cached data instantly
 * - Auto-refetches in background to keep fresh
 */
export function useUser(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<UserResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId!),
    queryFn: () => apiCall<UserResponse>(`/api/users/${userId}`),
    enabled: !!userId, // Only run if userId exists
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Fetch user's family details
 */
export function useUserFamily(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<FamilyResponse>, 'queryKey' | 'queryFn'>
) {
  // First get user to get family_id
  const { data: userData } = useUser(userId);
  const familyId = userData?.user?.family_id;

  return useQuery({
    queryKey: queryKeys.users.family(userId!),
    queryFn: () => apiCall<FamilyResponse>(`/api/families/${familyId}`),
    enabled: !!familyId, // Only run if we have family_id
    staleTime: 2 * 60 * 1000, // Family data stays fresh for 2 minutes
    ...options,
  });
}
