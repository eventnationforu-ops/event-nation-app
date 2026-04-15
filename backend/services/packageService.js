const packageModel = require('../models/packageModel');
const eventModel = require('../models/eventModel');
const { AppError } = require('../middleware/errorHandler');

const packageService = {
  async getPackagesByEventId(eventId) {
    const event = await eventModel.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    return packageModel.findByEventId(eventId);
  },
};

module.exports = packageService;
