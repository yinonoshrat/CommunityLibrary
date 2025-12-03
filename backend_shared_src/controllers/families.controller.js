import { db } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Get all families
 * @route GET /api/families
 */
export const getAllFamilies = asyncHandler(async (req, res) => {
  // Use optimized query that fetches families with members in single query
  // This replaces 190+ separate queries (1 for families + 1 per family for members)
  const families = await db.families.getAllWithMembers();
  res.json({ families });
});

/**
 * Get family by ID
 * @route GET /api/families/:id
 */
export const getFamilyById = asyncHandler(async (req, res) => {
  try {
    const family = await db.families.getById(req.params.id);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }
    res.json({ family });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('invalid input syntax')) {
      return res.status(404).json({ error: 'Family not found' });
    }
    throw error;
  }
});

/**
 * Check if family name exists
 * @route POST /api/families/check-name
 */
export const checkFamilyName = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Family name is required' });
  }

  // Use optimized query to get all families with members in single query
  const allFamilies = await db.families.getAllWithMembers();
  
  // Filter for matching names
  const matchingFamilies = allFamilies.filter(f =>
    f.name.toLowerCase() === name.toLowerCase()
  );

  res.json({
    exists: matchingFamilies.length > 0,
    families: matchingFamilies
  });
});

/**
 * Create a new family
 * @route POST /api/families
 */
export const createFamily = asyncHandler(async (req, res) => {
  // Validate required fields
  if (!req.body.name) {
    return res.status(400).json({ error: 'Family name is required' });
  }
  
  try {
    const family = await db.families.create(req.body);
    res.status(201).json({ family });
  } catch (error) {
    if (error.message?.includes('not-null constraint')) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    throw error;
  }
});

/**
 * Update a family
 * @route PUT /api/families/:id
 */
export const updateFamily = asyncHandler(async (req, res) => {
  try {
    const family = await db.families.update(req.params.id, req.body);
    if (!family) {
      return res.status(400).json({ error: 'Family not found' });
    }
    res.json({ family });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Family not found' });
    }
    throw error;
  }
});

/**
 * Delete a family
 * @route DELETE /api/families/:id
 */
export const deleteFamily = asyncHandler(async (req, res) => {
  try {
    await db.families.delete(req.params.id);
    res.json({ message: 'Family deleted successfully' });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Family not found' });
    }
    throw error;
  }
});

/**
 * Get all members of a family
 * @route GET /api/families/:id/members
 */
export const getFamilyMembers = asyncHandler(async (req, res) => {
  const members = await db.families.getMembers(req.params.id);
  res.json({ members });
});
