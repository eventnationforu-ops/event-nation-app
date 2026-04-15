const { pool } = require('../config/db');

const packageModel = {
  async findByEventId(eventId) {
    const result = await pool.query(
      'SELECT * FROM packages WHERE event_id = $1 ORDER BY base_price DESC',
      [eventId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM packages WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};

module.exports = packageModel;
