const asyncHandler = require('../middleware/asyncHandler');
const packageService = require('../services/packageService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const packageController = {
  getByEventId: asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    if (!isValidUUID(eventId)) throw new AppError('Invalid event ID', 400);

    const packages = await packageService.getPackagesByEventId(eventId);
    res.json({ success: true, data: packages });
  }),
};

module.exports = packageController;
