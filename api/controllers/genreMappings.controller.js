import { supabase } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Helper to check if error is due to missing genre_mappings table
 */
const isMissingGenreTableError = (error) => {
  return Boolean(error?.message && error.message.includes('genre_mappings') && error.message.includes('schema cache'));
};

/**
 * Get all genre mappings
 * @route GET /api/genre-mappings
 */
export const getAllGenreMappings = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('genre_mappings')
    .select('*')
    .order('usage_count', { ascending: false });

  if (error) {
    if (isMissingGenreTableError(error)) {
      console.warn('genre_mappings table missing - returning empty mapping list');
      return res.json({ mappings: [] });
    }
    console.error('Error fetching genre mappings:', error);
    return res.status(500).json({ error: 'Failed to fetch genre mappings' });
  }

  res.json({ mappings: data || [] });
});

/**
 * Save or update a genre mapping
 * @route POST /api/genre-mappings
 */
export const saveGenreMapping = asyncHandler(async (req, res) => {
  const { original_category, mapped_genre } = req.body;

  if (!original_category || !mapped_genre) {
    return res.status(400).json({ error: 'Missing required fields: original_category, mapped_genre' });
  }

  // Try to increment usage count if mapping exists
  const { data: existing, error: fetchError } = await supabase
    .from('genre_mappings')
    .select('*')
    .eq('original_category', original_category)
    .eq('mapped_genre', mapped_genre)
    .single();

  // Check if table doesn't exist
  if (fetchError && isMissingGenreTableError(fetchError)) {
    console.warn('genre_mappings table missing - genre mapping persistence disabled');
    return res.status(501).json({
      error: 'Genre mappings storage is not configured yet',
      message: 'Create the genre_mappings table to enable this feature',
    });
  }

  if (existing) {
    // Update existing mapping
    const { data, error } = await supabase
      .from('genre_mappings')
      .update({
        usage_count: existing.usage_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      if (isMissingGenreTableError(error)) {
        console.warn('genre_mappings table missing - genre mapping persistence disabled');
        return res.status(501).json({
          error: 'Genre mappings storage is not configured yet',
          message: 'Create the genre_mappings table to enable this feature',
        });
      }
      console.error('Error updating genre mapping:', error);
      return res.status(500).json({ error: 'Failed to update genre mapping' });
    }
    res.json({ mapping: data });
  } else {
    // Create new mapping
    const { data, error } = await supabase
      .from('genre_mappings')
      .insert({
        original_category,
        mapped_genre,
        usage_count: 1
      })
      .select()
      .single();

    if (error) {
      if (isMissingGenreTableError(error)) {
        console.warn('genre_mappings table missing - genre mapping persistence disabled');
        return res.status(501).json({
          error: 'Genre mappings storage is not configured yet',
          message: 'Create the genre_mappings table to enable this feature',
        });
      }
      console.error('Error creating genre mapping:', error);
      return res.status(500).json({ error: 'Failed to create genre mapping' });
    }
    res.json({ mapping: data });
  }
});
