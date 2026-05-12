const { pool } = require('../config/db');

const bookingModel = {
  async create(client, data) {
    const { user_id, user_name, phone, email, event_id, package_id, subtotal, gst, total } = data;
    const result = await client.query(
      `INSERT INTO bookings
         (user_id, user_name, phone, email, event_id, package_id, subtotal, gst, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [user_id || null, user_name, phone, email, event_id, package_id, subtotal, gst, total]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByUserId(userId) {
    const result = await pool.query(
      `SELECT b.*, e.title AS event_title, p.name AS package_name
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       JOIN packages p ON p.id = b.package_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async findAll() {
    const result = await pool.query(
      `SELECT b.*, e.title AS event_title, p.name AS package_name
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       JOIN packages p ON p.id = b.package_id
       ORDER BY b.created_at DESC`
    );
    return result.rows;
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  },

  async updatePaymentStatus(id, paymentStatus) {
    const result = await pool.query(
      'UPDATE bookings SET payment_status = $1 WHERE id = $2 RETURNING *',
      [paymentStatus, id]
    );
    return result.rows[0] || null;
  },
};

module.exports = bookingModel;
