const asyncHandler = require('../middleware/asyncHandler');
const bookingModel = require('../models/bookingModel');
const memberModel = require('../models/memberModel');
const ticketModel = require('../models/ticketModel');
const refundService = require('../services/refundService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const adminController = {
  getAllBookings: asyncHandler(async (req, res) => {
    const bookings = await bookingModel.findAll();
    res.json({ success: true, data: bookings });
  }),

  getBookingDetails: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Valid booking id is required', 400);

    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found', 404);

    const members = await memberModel.findByBookingId(id);
    const tickets = await ticketModel.findByBookingId(id);

    res.json({
      success: true,
      data: { booking, family_members: members, member_tickets: tickets },
    });
  }),

  verifyMember: asyncHandler(async (req, res) => {
    const { member_id, status, admin_notes } = req.body;
    if (!member_id || !isValidUUID(member_id)) {
      throw new AppError('Valid member_id is required', 400);
    }
    if (!['verified', 'rejected'].includes(status)) {
      throw new AppError('status must be verified or rejected', 400);
    }

    const updated = await memberModel.updateVerificationStatus(member_id, status, admin_notes);
    if (!updated) throw new AppError('Family member not found', 404);

    res.json({ success: true, data: updated });
  }),

  updatePaymentStatus: asyncHandler(async (req, res) => {
    const { booking_id, payment_status } = req.body;
    if (!booking_id || !isValidUUID(booking_id)) {
      throw new AppError('Valid booking_id is required', 400);
    }
    if (!['unpaid', 'paid', 'refunded', 'partial_refund'].includes(payment_status)) {
      throw new AppError('Invalid payment_status', 400);
    }

    const updated = await bookingModel.updatePaymentStatus(booking_id, payment_status);
    if (!updated) throw new AppError('Booking not found', 404);

    res.json({ success: true, data: updated });
  }),

  approveRefund: asyncHandler(async (req, res) => {
    const { refund_id } = req.body;
    if (!refund_id || !isValidUUID(refund_id)) {
      throw new AppError('Valid refund_id is required', 400);
    }

    const result = await refundService.approveRefund(refund_id);
    res.json({ success: true, data: result });
  }),

  rejectRefund: asyncHandler(async (req, res) => {
    const { refund_id } = req.body;
    if (!refund_id || !isValidUUID(refund_id)) {
      throw new AppError('Valid refund_id is required', 400);
    }

    const result = await refundService.rejectRefund(refund_id);
    res.json({ success: true, data: result });
  }),
};

module.exports = adminController;
