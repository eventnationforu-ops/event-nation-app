const { pool } = require('../config/db');

const memberModel = {
  async createMany(client, bookingId, members) {
    const inserted = [];
    for (const member of members) {
      const result = await client.query(
        `INSERT INTO family_members (booking_id, name, age, gender)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [bookingId, member.name, member.age, member.gender.toLowerCase()]
      );
      inserted.push(result.rows[0]);
    }
    return inserted;
  },

  async findByBookingId(bookingId) {
    const result = await pool.query(
      'SELECT * FROM family_members WHERE booking_id = $1 ORDER BY created_at ASC',
      [bookingId]
    );
    return result.rows;
  },

  async updateVerificationStatus(memberId, status, adminNotes) {
    const result = await pool.query(
      `UPDATE family_members
       SET id_verification_status = $1, admin_notes = $2
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes || null, memberId]
    );
    return result.rows[0] || null;
  },
};

module.exports = memberModel;
