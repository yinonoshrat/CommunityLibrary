import { db } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Get all families
 * @route GET /api/families
 */
export const getAllFamilies = asyncHandler(async (req, res) => {
  const families = await db.families.getAll();

  // Get members for each family to help identify families with same names
  const familiesWithMembers = await Promise.all(
    families.map(async (family) => {
      try {
        const members = await db.families.getMembers(family.id);
        return {
          ...family,
          members: members.map(m => ({ id: m.id, full_name: m.full_name }))
        };
      } catch (error) {
        console.error(`Error getting members for family ${family.id}:`, error);
        // Return family without members on error
        return {
          ...family,
          members: []
        };
      }
    })
  );

  res.json({ families: familiesWithMembers });
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

  // Find families with matching name using db adapter
  const allFamilies = await db.families.getAll();
  const matchingFamilies = allFamilies.filter(f =>
    f.name.toLowerCase() === name.toLowerCase()
  );

  // Get members for each matching family
  const familiesWithMembers = await Promise.all(
    matchingFamilies.map(async (family) => {
      try {
        const members = await db.families.getMembers(family.id);
        return {
          ...family,
          members: members.map(m => ({ id: m.id, full_name: m.full_name }))
        };
      } catch (err) {
        console.error('Error getting members for family:', family.id, err);
        return {
          ...family,
          members: []
        };
      }
    })
  );

  res.json({
    exists: familiesWithMembers.length > 0,
    families: familiesWithMembers
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
