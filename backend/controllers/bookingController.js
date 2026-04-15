const asyncHandler = require('../middleware/asyncHandler');
const bookingService = require('../services/bookingService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const bookingController = {
  preview: asyncHandler(async (req, res) => {
    const result = await bookingService.previewBooking(req.body);
    res.json({ success: true, data: result });
  }),

  create: asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const result = await bookingService.createBooking(req.body, userId);
    res.status(201).json({ success: true, data: result });
  }),

  confirm: asyncHandler(async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id || !isValidUUID(booking_id)) {
      throw new AppError('Valid booking_id is required', 400);
    }

    await bookingService.assertBookingOwner(booking_id, req.user.id);
    const result = await bookingService.confirmBooking(booking_id);
    res.json({ success: true, data: result });
  }),

  cancel: asyncHandler(async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id || !isValidUUID(booking_id)) {
      throw new AppError('Valid booking_id is required', 400);
    }

    await bookingService.assertBookingOwner(booking_id, req.user.id);
    const refundService = require('../services/refundService');
    const result = await refundService.cancelBooking(booking_id);
    res.json({ success: true, data: result });
  }),

  myBookings: asyncHandler(async (req, res) => {
    const result = await bookingService.getMyBookings(req.user.id);
    res.json({ success: true, data: result });
  }),
};

module.exports = bookingController;
