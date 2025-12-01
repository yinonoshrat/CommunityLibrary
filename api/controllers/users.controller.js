import { db } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Get all users
 * @route GET /api/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { familyId, noFamily } = req.query;
  const users = familyId
    ? await db.users.getAll({ familyId })
    : noFamily
    ? await db.users.getAll({ noFamily: true })
    : await db.users.getAll();
  res.json({ users });
});

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  try {
    const user = await db.users.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('invalid input syntax')) {
      return res.status(404).json({ error: 'User not found' });
    }
    throw error;
  }
});

/**
 * Update a user
 * @route PUT /api/users/:id
 */
export const updateUser = asyncHandler(async (req, res) => {
  // Validate that there's something to update
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'No update data provided' });
  }
  
  try {
    const user = await db.users.update(req.params.id, req.body);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return res.status(400).json({ error: 'User not found' });
    }
    throw error;
  }
});

/**
 * Delete a user
 * @route DELETE /api/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
  await db.users.delete(req.params.id);
  res.json({ message: 'User deleted successfully' });
});
