const { pool } = require('../config/db');

const paymentModel = {
  async create(bookingId, amount) {
    const result = await pool.query(
      `INSERT INTO payments (booking_id, amount, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [bookingId, amount]
    );
    return result.rows[0];
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      'UPDATE payments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  },

  async findByBookingId(bookingId) {
    const result = await pool.query(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC',
      [bookingId]
    );
    return result.rows;
  },
};

module.exports = paymentModel;
