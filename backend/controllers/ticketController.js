const asyncHandler = require('../middleware/asyncHandler');
const ticketService = require('../services/ticketService');
const bookingService = require('../services/bookingService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const ticketController = {
  getByBookingId: asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) throw new AppError('Invalid booking ID', 400);

    await bookingService.assertBookingOwner(bookingId, req.user.id);
    const tickets = await ticketService.getTicketsByBookingId(bookingId);
    res.json({ success: true, data: tickets });
  }),
};

module.exports = ticketController;
