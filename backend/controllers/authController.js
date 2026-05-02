const asyncHandler = require('../middleware/asyncHandler');

const authController = {
  getMe: asyncHandler(async (req, res) => {
    const roles = req.user.roles || [];
    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        role: roles.includes('admin') ? 'admin' : 'user',
        roles,
        profile: null,
      },
    });
  }),

  logout: asyncHandler(async (_req, res) => {
    res.json({ success: true, message: 'Logged out' });
  }),
};

module.exports = authController;
