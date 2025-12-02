import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiCall } from '../utils/apiCall';
import { queryKeys } from './queryKeys';

// Types for family operations
export interface FamilyMember {
  id: number;
  full_name: string;
  email?: string;
  role?: string;
}

export interface Family {
  id: number;
  name: string;
  created_at: string;
  members?: FamilyMember[]; // Optional members array
}

export interface FamilyWithMembers extends Family {
  members: FamilyMember[]; // Required members array
}

/**
 * Hook to fetch all families
 * Used in admin contexts or family selection dropdowns
 */
export function useFamilies(
  options?: Omit<UseQueryOptions<Family[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Family[], Error>({
    queryKey: queryKeys.families.all,
    queryFn: async () => {
      const data = await apiCall<{ families: Family[] }>('/api/families');
      return data.families || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - families don't change often
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch a specific family's details
 * Returns family info and members
 */
export function useFamily(
  familyId: number | null | undefined,
  options?: Omit<UseQueryOptions<FamilyWithMembers, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<FamilyWithMembers, Error>({
    queryKey: queryKeys.families.detail(String(familyId)),
    queryFn: () => apiCall<FamilyWithMembers>(`/api/families/${familyId}`),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch family members
 * Alternative to useFamily when only members are needed
 */
export function useFamilyMembers(
  familyId: number | null | undefined,
  options?: Omit<UseQueryOptions<FamilyMember[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<FamilyMember[], Error>({
    queryKey: queryKeys.families.members(String(familyId)),
    queryFn: async () => {
      const data = await apiCall<{ members: FamilyMember[] }>(`/api/families/${familyId}/members`);
      return data.members || [];
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
}

/**
 * Hook to check book availability across families
 * Shows which families have copies of a specific book
 */
export function useFamilyAvailability(
  bookId: number | null | undefined,
  options?: Omit<UseQueryOptions<any[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<any[], Error>({
    queryKey: ['families', 'availability', bookId],
    queryFn: async () => {
      const data = await apiCall<{ availability: any[] }>(`/api/books/${bookId}/availability`);
      return data.availability || [];
    },
    enabled: !!bookId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
}
