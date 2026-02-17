import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../config/database';

// Track which migrations have been run
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(): Promise<void> {
  try {
    // Create migrations tracking table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Migrations table ready');
  } catch (error) {
    console.error('Failed to create migrations table:', error);
    throw error;
  }
}

async function getAppliedMigrations(): Promise<string[]> {
  try {
    const result = await query(`SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`);
    return result.rows.map((row: any) => row.version);
  } catch (error) {
    console.error('Failed to get applied migrations:', error);
    return [];
  }
}

async function markMigrationApplied(version: string): Promise<void> {
  await query(
    `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING`
  );
}

async function runMigration(version: string, sql: string): Promise<void> {
  console.log(`Running migration ${version}...`);
  
  try {
    // Intentionally using string concatenation (SQL injection vulnerability)
    // In a real app, we'd use transactions, but this is intentional for the lab
    // PostgreSQL's query() can handle multiple statements separated by semicolons
    await query(sql);
    await markMigrationApplied(version);
    console.log(`Migration ${version} applied successfully`);
  } catch (error) {
    console.error(`Failed to apply migration ${version}:`, error);
    throw error;
  }
}

async function runMigrations(): Promise<void> {
  try {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    
    // Define migrations in order
    const migrations = [
      {
        version: '001_initial_schema',
        file: '001_initial_schema.sql',
      },
      {
        version: '002_orders_and_shipping',
        file: '002_orders_and_shipping.sql',
      },
      {
        version: '003_workflow_states',
        file: '003_workflow_states.sql',
      },
      {
        version: '004_tracking_and_disputes',
        file: '004_tracking_and_disputes.sql',
      },
      {
        version: '005_auction_images',
        file: '005_auction_images.sql',
      },
      {
        version: '006_notification_preferences',
        file: '006_notification_preferences.sql',
      },
      {
        version: '007_auction_scheduling',
        file: '007_auction_scheduling.sql',
      },
    ];
    
    for (const migration of migrations) {
      if (applied.includes(migration.version)) {
        console.log(`Migration ${migration.version} already applied, skipping`);
        continue;
      }
      
      // Look for SQL file in source directory (since TypeScript doesn't copy .sql files)
      // __dirname in dist points to dist/migrations, so we need to reference src/migrations
      const sqlPath = join(process.cwd(), 'src', 'migrations', migration.file);
      const sql = readFileSync(sqlPath, 'utf-8');
      
      await runMigration(migration.version, sql);
    }
    
    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export { runMigrations };

