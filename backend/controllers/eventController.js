const asyncHandler = require('../middleware/asyncHandler');
const eventService = require('../services/eventService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const eventController = {
  getAll: asyncHandler(async (req, res) => {
    const events = await eventService.getAllEvents();
    res.json({ success: true, data: events });
  }),

  getById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Invalid event ID', 400);

    const event = await eventService.getEventById(id);
    res.json({ success: true, data: event });
  }),
};

module.exports = eventController;
