const { pool } = require('../config/db');
const packageModel = require('../models/packageModel');
const eventModel = require('../models/eventModel');
const bookingModel = require('../models/bookingModel');
const memberModel = require('../models/memberModel');
const { AppError } = require('../middleware/errorHandler');
const { calculatePricing } = require('../utils/pricingEngine');
const { validatePreviewInput, validateBookingInput } = require('../utils/validators');

const bookingService = {
  async previewBooking(body) {
    validatePreviewInput(body);

    const { package_id, members } = body;

    const pkg = await packageModel.findById(package_id);
    if (!pkg) {
      throw new AppError('Package not found', 404);
    }

    const pricing = calculatePricing(pkg, members);
    return {
      package_name: pkg.name,
      ...pricing,
    };
  },

  async createBooking(body, userId) {
    if (!userId) {
      throw new AppError('Authenticated user is required to create a booking', 401);
    }

    validateBookingInput(body);

    const { event_id, package_id, members, user_name, phone, email } = body;

    const event = await eventModel.findById(event_id);
    if (!event) throw new AppError('Event not found', 404);

    const pkg = await packageModel.findById(package_id);
    if (!pkg) throw new AppError('Package not found', 404);

    if (pkg.event_id !== event_id) {
      throw new AppError('Package does not belong to the specified event', 400);
    }

    const pricing = calculatePricing(pkg, members);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const booking = await bookingModel.create(client, {
        user_id: userId,
        user_name,
        phone,
        email,
        event_id,
        package_id,
        subtotal: pricing.subtotal,
        gst: pricing.gst,
        total: pricing.total,
      });

      const insertedMembers = await memberModel.createMany(client, booking.id, members);

      await client.query('COMMIT');

      return {
        booking,
        members: insertedMembers,
        pricing,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[BOOKING] Failed to create booking for user ${userId}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  },

  async confirmBooking(bookingId) {
    const booking = await bookingModel.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);

    if (booking.status !== 'pending') {
      throw new AppError(`Cannot confirm booking with status: ${booking.status}`, 400);
    }

    const updatedBooking = await bookingModel.updateStatus(bookingId, 'confirmed');

    const ticketService = require('./ticketService');
    const tickets = await ticketService.generateTickets(bookingId);

    return { booking: updatedBooking, tickets };
  },

  async getMyBookings(userId) {
    return bookingModel.findByUserId(userId);
  },

  /**
   * Verify that the given booking belongs to the authenticated user.
   * Throws 404 if the booking doesn't exist, 403 if the user doesn't own it.
   */
  async assertBookingOwner(bookingId, userId) {
    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }
    if (booking.user_id !== userId) {
      console.warn(`[BOOKING] User ${userId} attempted to access booking ${bookingId} owned by ${booking.user_id}`);
      throw new AppError('You do not have permission to modify this booking', 403);
    }
    return booking;
  },
};

module.exports = bookingService;
