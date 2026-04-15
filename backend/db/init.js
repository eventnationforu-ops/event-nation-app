require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('../config/db');

async function initDatabase() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot initialize database — connection failed.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema...');
    await client.query(schema);
    console.log('Schema created successfully.');

    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      console.log('Running seed data...');
      await client.query(seed);
      console.log('Seed data inserted successfully.');
    } else {
      console.log('No seed.sql found — skipping seed data.');
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.error('Detail:', err.detail || 'none');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
