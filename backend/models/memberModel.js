const { pool } = require('../config/db');
const { MAX_CHILD_AGE } = require('../utils/pricingEngine');

const memberModel = {
  async createMany(client, bookingId, members) {
    const inserted = [];
    for (const member of members) {
      const isChild = member.age <= MAX_CHILD_AGE;
      const result = await client.query(
        `INSERT INTO family_members
           (booking_id, full_name, age, gender, is_child, id_proof_url, face_photo_url, id_verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          bookingId,
          member.name,
          member.age,
          member.gender.toLowerCase(),
          isChild,
          member.id_proof_url || null,
          member.face_photo_url || null,
        ]
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
