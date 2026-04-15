const eventModel = require('../models/eventModel');
const { AppError } = require('../middleware/errorHandler');

const eventService = {
  async getAllEvents() {
    return eventModel.findAll();
  },

  async getEventById(id) {
    const event = await eventModel.findById(id);
    if (!event) {
      throw new AppError('Event not found', 404);
    }
    return event;
  },
};

module.exports = eventService;
