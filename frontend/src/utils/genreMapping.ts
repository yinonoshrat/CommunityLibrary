/**
 * Genre Mapping Utility
 * 
 * Maps Google Books categories to Hebrew genre labels used in the app.
 */

interface GenreMapping {
  original_category: string;
  mapped_genre: string;
  usage_count: number;
}

/**
 * Deduce Hebrew genre from Google Books categories using basic fallback mappings
 */
export function deduceGenre(
  categories: string[] | undefined,
  _mappings?: GenreMapping[]
): string | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Basic English-to-Hebrew mapping for common categories
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

  const lowerCategories = categories.map(c => c.toLowerCase());
  
  for (const category of lowerCategories) {
    for (const [key, genre] of Object.entries(fallbackMappings)) {
      if (category.includes(key)) {
        return genre;
      }
    }
  }

  return null;
}

// Genre mapping persistence removed - functionality simplified to local mapping only
export async function saveGenreMapping(_originalCategory: string, _mappedGenre: string): Promise<void> {
  // No-op: genre mapping persistence removed
}

export async function fetchGenreMappings(): Promise<GenreMapping[]> {
  // No-op: genre mapping persistence removed
  return [];
}
