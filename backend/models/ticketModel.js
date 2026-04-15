const { pool } = require('../config/db');

const ticketModel = {
  async create(memberId, bookingId, eventId, qrCode) {
    const result = await pool.query(
      `INSERT INTO member_tickets (member_id, booking_id, event_id, qr_code, qr_status, status)
       VALUES ($1, $2, $3, $4, 'active', 'active')
       RETURNING *`,
      [memberId, bookingId, eventId, qrCode]
    );
    return result.rows[0];
  },

  async findByBookingId(bookingId) {
    const result = await pool.query(
      `SELECT mt.*, fm.full_name, fm.age, fm.gender, fm.is_child
       FROM member_tickets mt
       JOIN family_members fm ON fm.id = mt.member_id
       WHERE mt.booking_id = $1
       ORDER BY fm.created_at ASC`,
      [bookingId]
    );
    return result.rows;
  },

  async findByEventId(eventId) {
    const result = await pool.query(
      `SELECT mt.*, fm.full_name, fm.age, fm.gender, fm.is_child
       FROM member_tickets mt
       JOIN family_members fm ON fm.id = mt.member_id
       WHERE mt.event_id = $1
       ORDER BY mt.created_at ASC`,
      [eventId]
    );
    return result.rows;
  },

  async cancelByBookingId(bookingId) {
    const result = await pool.query(
      `UPDATE member_tickets SET status = 'cancelled', qr_status = 'cancelled'
       WHERE booking_id = $1
       RETURNING *`,
      [bookingId]
    );
    return result.rows;
  },

  async updateQrStatus(ticketId, qrStatus) {
    const result = await pool.query(
      'UPDATE member_tickets SET qr_status = $1 WHERE id = $2 RETURNING *',
      [qrStatus, ticketId]
    );
    return result.rows[0] || null;
  },
};

module.exports = ticketModel;
