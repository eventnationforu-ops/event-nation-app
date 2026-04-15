const { pool } = require('../config/db');

const userRoleModel = {
  async findByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM user_roles WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  },

  async hasRole(userId, role) {
    const result = await pool.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2',
      [userId, role]
    );
    return result.rows.length > 0;
  },

  async assignRole(userId, role) {
    const result = await pool.query(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role) DO NOTHING
       RETURNING *`,
      [userId, role]
    );
    return result.rows[0] || null;
  },
};

module.exports = userRoleModel;
