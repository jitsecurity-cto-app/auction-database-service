/**
 * Database reset utility
 * This script programmatically resets the database by dropping all tables
 * and re-running migrations. Useful for CI/CD pipelines and automated testing.
 * 
 * Intentionally drops all data without backup (for lab environment)
 */

import { Pool } from 'pg';
import { env } from '../config/env';
import { runMigrations } from '../migrations';

async function resetDatabase(): Promise<void> {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  try {
    console.log('🔄 Starting database reset...');
    
    const client = await pool.connect();
    
    try {
      // Drop all tables in reverse dependency order to avoid foreign key constraints
      console.log('🗑️  Dropping all tables...');
      
      await client.query('DROP TABLE IF EXISTS orders CASCADE');
      console.log('   ✓ Dropped orders table');
      
      await client.query('DROP TABLE IF EXISTS bids CASCADE');
      console.log('   ✓ Dropped bids table');
      
      await client.query('DROP TABLE IF EXISTS auctions CASCADE');
      console.log('   ✓ Dropped auctions table');
      
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      console.log('   ✓ Dropped users table');
      
      await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
      console.log('   ✓ Dropped schema_migrations table');
      
      console.log('✅ All tables dropped successfully');
      
    } finally {
      client.release();
    }
    
    await pool.end();
    
    // Run migrations to recreate schema
    console.log('🗄️  Running migrations...');
    await runMigrations();
    
    console.log('✅ Database reset complete!');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { resetDatabase };
