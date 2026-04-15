const { pool } = require('../config/db');

const eventModel = {
  async findAll() {
    const result = await pool.query(
      'SELECT * FROM events ORDER BY event_date ASC'
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};

module.exports = eventModel;
