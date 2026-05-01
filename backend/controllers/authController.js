const asyncHandler = require('../middleware/asyncHandler');
const userRoleModel = require('../models/userRoleModel');
const profileModel = require('../models/profileModel');

const authController = {
  getMe: asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const profile = await profileModel.findById(userId);
    const roles = await userRoleModel.findByUserId(userId);
    const roleNames = roles.map((r) => r.role);

    res.json({
      success: true,
      data: {
        id: userId,
        email: req.user.email,
        role: roleNames.includes('admin') ? 'admin' : 'user',
        roles: roleNames,
        profile: profile || null,
      },
    });
  }),

  logout: asyncHandler(async (_req, res) => {
    // Supabase handles token invalidation client-side.
    // This endpoint exists for completeness and future server-side cleanup.
    res.json({ success: true, message: 'Logged out' });
  }),
};

module.exports = authController;
