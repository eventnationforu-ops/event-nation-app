const bookingModel = require('../models/bookingModel');
const eventModel = require('../models/eventModel');
const refundModel = require('../models/refundModel');
const ticketModel = require('../models/ticketModel');
const { AppError } = require('../middleware/errorHandler');
const { calculateRefund } = require('../utils/refundCalculator');

const refundService = {
  /**
   * Initiate a cancellation / refund request for a booking.
   */
  async cancelBooking(bookingId) {
    const booking = await bookingModel.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);

    if (booking.status === 'cancelled' || booking.status === 'cancel_pending') {
      throw new AppError(`Booking is already ${booking.status}`, 400);
    }
    if (booking.status !== 'confirmed') {
      throw new AppError('Only confirmed bookings can be cancelled', 400);
    }

    const event = await eventModel.findById(booking.event_id);
    if (!event) throw new AppError('Associated event not found', 404);

    const refundInfo = calculateRefund(booking.total, event.event_date);

    // Create refund request
    const refundRequest = await refundModel.create({
      booking_id: bookingId,
      refund_percentage: refundInfo.refund_percentage,
      refund_amount: refundInfo.refund_amount,
      processing_fee: refundInfo.processing_fee,
    });

    // Set booking status to cancel_pending
    await bookingModel.updateStatus(bookingId, 'cancel_pending');

    // Cancel all tickets
    await ticketModel.cancelByBookingId(bookingId);

    return {
      refund_request: refundRequest,
      refund_details: refundInfo,
    };
  },

  /**
   * Admin: approve a refund request.
   */
  async approveRefund(refundId) {
    const refund = await refundModel.findById(refundId);
    if (!refund) throw new AppError('Refund request not found', 404);

    if (refund.status !== 'pending') {
      throw new AppError(`Refund request is already ${refund.status}`, 400);
    }

    const updatedRefund = await refundModel.updateStatus(refundId, 'approved');
    await bookingModel.updateStatus(refund.booking_id, 'cancelled');

    return updatedRefund;
  },

  /**
   * Admin: reject a refund request.
   */
  async rejectRefund(refundId) {
    const refund = await refundModel.findById(refundId);
    if (!refund) throw new AppError('Refund request not found', 404);

    if (refund.status !== 'pending') {
      throw new AppError(`Refund request is already ${refund.status}`, 400);
    }

    const updatedRefund = await refundModel.updateStatus(refundId, 'rejected');
    // Restore booking to confirmed status
    await bookingModel.updateStatus(refund.booking_id, 'confirmed');

    return updatedRefund;
  },
};

module.exports = refundService;
