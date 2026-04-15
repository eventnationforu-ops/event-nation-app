const { pool } = require('../config/db');

const refundModel = {
  async create(data) {
    const { booking_id, refund_percentage, refund_amount, processing_fee } = data;
    const result = await pool.query(
      `INSERT INTO refund_requests (booking_id, refund_percentage, refund_amount, processing_fee, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [booking_id, refund_percentage, refund_amount, processing_fee]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM refund_requests WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async findByBookingId(bookingId) {
    const result = await pool.query(
      'SELECT * FROM refund_requests WHERE booking_id = $1 ORDER BY created_at DESC',
      [bookingId]
    );
    return result.rows;
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      'UPDATE refund_requests SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  },
};

module.exports = refundModel;
