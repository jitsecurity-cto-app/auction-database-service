import { Pool, PoolClient } from 'pg';
import { env } from './env';

// Create PostgreSQL connection pool
// Intentionally using raw SQL queries without parameterization (SQL injection vulnerability)
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Intentionally verbose error logging (security vulnerability)
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    code: (err as any).code,
  });
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    // Intentionally verbose logging (security vulnerability)
    console.log('Database connection successful');
    console.log('Database time:', result.rows[0].now);
    console.log('Connection pool status:', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
    
    return true;
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Database connection failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

// Execute a query (intentionally vulnerable - no parameterization)
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  
  // Intentionally log all queries including user input (security vulnerability)
  console.log('Executing query:', text);
  if (params) {
    console.log('Query parameters:', params);
  }
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Intentionally verbose logging (security vulnerability)
    console.log('Query executed successfully', {
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Intentionally verbose error logging including stack traces (security vulnerability)
    console.error('Query failed:', {
      query: text,
      params: params,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    throw error;
  }
}

// Get a client from the pool for transactions
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

// Close the pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database connection pool closed');
}

export default pool;

