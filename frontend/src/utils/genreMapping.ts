/**
 * Genre Mapping Utility
 * 
 * Maps Google Books categories to Hebrew genre labels used in the app.
 * Learns from user selections to improve future mappings.
 */

interface GenreMapping {
  id: string;
  original_category: string;
  mapped_genre: string;
  usage_count: number;
}

/**
 * Deduce Hebrew genre from Google Books categories using learned mappings
 */
export function deduceGenre(
  categories: string[] | undefined,
  mappings: GenreMapping[]
): string | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Build a map of category to genre with usage counts
  const categoryToGenre = new Map<string, { genre: string; count: number }>();
  
  for (const mapping of mappings) {
    const existing = categoryToGenre.get(mapping.original_category);
    if (!existing || mapping.usage_count > existing.count) {
      categoryToGenre.set(mapping.original_category, {
        genre: mapping.mapped_genre,
        count: mapping.usage_count,
      });
    }
  }

  // Try to find exact match first
  for (const category of categories) {
    const match = categoryToGenre.get(category);
    if (match) {
      return match.genre;
    }
  }

  // Try partial matches (case-insensitive)
  const lowerCategories = categories.map(c => c.toLowerCase());
  for (const [mappedCategory, { genre }] of categoryToGenre.entries()) {
    const lowerMapped = mappedCategory.toLowerCase();
    if (lowerCategories.some(cat => cat.includes(lowerMapped) || lowerMapped.includes(cat))) {
      return genre;
    }
  }

  // Fallback: basic English-to-Hebrew mapping for common categories
  const fallbackMappings: Record<string, string> = {
    'fiction': 'רומן',
    'juvenile fiction': 'ילדים',
    'young adult fiction': 'נוער',
    'fantasy': 'פנטזיה',
    'science fiction': 'מדע בדיוני',
    'mystery': 'מתח',
    'thriller': 'מתח',
    'biography': 'ביוגרפיה',
    'history': 'היסטוריה',
    'science': 'מדע',
    'poetry': 'שירה',
    'children': 'ילדים',
    'juvenile': 'ילדים',
    'young adult': 'נוער',
  };

  for (const category of lowerCategories) {
    for (const [key, genre] of Object.entries(fallbackMappings)) {
      if (category.includes(key)) {
        return genre;
      }
    }
  }

  return null;
}

/**
 * Save a new category-to-genre mapping or update existing one
 */
export async function saveGenreMapping(
  originalCategory: string,
  mappedGenre: string
): Promise<void> {
  try {
    const response = await fetch('/api/genre-mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_category: originalCategory,
        mapped_genre: mappedGenre,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save genre mapping');
    }
  } catch (error) {
    console.error('Error saving genre mapping:', error);
    // Don't throw - this is a learning feature, shouldn't block the main flow
  }
}

/**
 * Fetch all genre mappings from the database
 */
export async function fetchGenreMappings(): Promise<GenreMapping[]> {
  try {
    const response = await fetch('/api/genre-mappings');
    
    if (!response.ok) {
      throw new Error('Failed to fetch genre mappings');
    }

    const data = await response.json();
    return data.mappings || [];
  } catch (error) {
    console.error('Error fetching genre mappings:', error);
    return [];
  }
}
