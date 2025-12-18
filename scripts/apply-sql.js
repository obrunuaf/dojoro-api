/**
 * Apply SQL files to Postgres in order
 * Usage: node scripts/apply-sql.js
 * 
 * Reads all *.sql files from sql/ directory, sorts by filename,
 * and executes them in order against the database.
 * 
 * Environment variables required:
 * - DATABASE_URL or individual: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const sqlDir = path.join(__dirname, '..', 'sql');
  
  // Get connection config from environment
  const connectionConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5433', 10),
        user: process.env.PGUSER || 'dojoro_ci',
        password: process.env.PGPASSWORD || 'dojoro_ci_password',
        database: process.env.PGDATABASE || 'dojoro_test',
      };

  console.log('Connecting to database...');
  console.log(`  Host: ${connectionConfig.host || 'from URL'}`);
  console.log(`  Port: ${connectionConfig.port || 'from URL'}`);
  console.log(`  Database: ${connectionConfig.database || 'from URL'}`);

  const client = new Client(connectionConfig);
  
  try {
    await client.connect();
    console.log('Connected successfully!\n');

    // Get all SQL files sorted by name
    const files = fs.readdirSync(sqlDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`Found ${files.length} SQL files:\n`);

    for (const file of files) {
      const filePath = path.join(sqlDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Applying: ${file}...`);
      
      try {
        await client.query(sql);
        console.log(`  ✓ Success`);
      } catch (err) {
        // Some files may have duplicate definitions, try to continue
        if (err.code === '42P07' || err.code === '42710') {
          // Relation/constraint already exists
          console.log(`  ⚠ Already exists (continuing): ${err.message.split('\n')[0]}`);
        } else if (err.code === '23505') {
          // Duplicate key (for seeds)
          console.log(`  ⚠ Duplicate data (continuing): ${err.message.split('\n')[0]}`);
        } else {
          console.error(`  ✗ Error: ${err.message}`);
          throw err;
        }
      }
    }

    console.log('\n✓ All SQL files applied successfully!');
  } catch (err) {
    console.error('\n✗ Failed to apply SQL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
