require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('../config/db');

async function runMigration() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot run migration — connection failed.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, 'migration.sql');
    if (!fs.existsSync(migrationPath)) {
      console.log('No migration.sql found — nothing to do.');
      return;
    }

    const migration = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running migration...');
    await client.query(migration);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error('Detail:', err.detail || 'none');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
