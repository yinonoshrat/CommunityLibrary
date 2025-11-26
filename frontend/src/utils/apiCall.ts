import { supabase } from '../lib/supabase';

export async function apiCall<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    // Get auth token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    // Don't set Content-Type for FormData - browser will set it with boundary
    const isFormData = options?.body instanceof FormData;
    
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('שגיאת רשת - אנא בדוק את החיבור לאינטרנט');
    }
    throw error;
  }
}
