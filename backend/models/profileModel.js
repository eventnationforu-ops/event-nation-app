const { pool } = require('../config/db');

const profileModel = {
  async findById(id) {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  async upsert(data) {
    const { id, full_name, phone, email, avatar_url } = data;
    const result = await pool.query(
      `INSERT INTO profiles (id, full_name, phone, email, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
             phone     = COALESCE(EXCLUDED.phone, profiles.phone),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)
       RETURNING *`,
      [id, full_name || null, phone || null, email, avatar_url || null]
    );
    return result.rows[0];
  },
};

module.exports = profileModel;
