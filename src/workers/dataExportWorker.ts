/**
 * Data Export Worker
 *
 * Triggered daily by EventBridge:
 * Exports RDS data to S3 as partitioned JSON for Athena queries.
 *
 * Security vulnerabilities (intentional):
 * - PII exported to unencrypted S3 data lake
 * - No data masking or anonymization
 */

import { Pool } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.DATA_LAKE_BUCKET || 'auction-lab-data-lake-dev';

async function exportTable(tableName: string): Promise<number> {
  const result = await pool.query(`SELECT * FROM ${tableName}`);
  const rows = result.rows;

  if (rows.length === 0) {
    console.log(`No data to export for ${tableName}`);
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  const jsonLines = rows.map(row => JSON.stringify(row)).join('\n');

  // Export as partitioned JSON (year/month/day)
  const [year, month, day] = today.split('-');
  const key = `${tableName}/year=${year}/month=${month}/day=${day}/data.json`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: jsonLines,
    ContentType: 'application/json',
    // No encryption (intentional vulnerability: PII in unencrypted data lake)
  }));

  console.log(`Exported ${rows.length} rows from ${tableName} to s3://${BUCKET}/${key}`);
  return rows.length;
}

export const handler = async (): Promise<{ tables: Record<string, number> }> => {
  console.log('Data export worker invoked at:', new Date().toISOString());

  const tables = ['auctions', 'bids', 'orders', 'users', 'disputes'];
  const results: Record<string, number> = {};

  for (const table of tables) {
    try {
      results[table] = await exportTable(table);
    } catch (error) {
      console.error(`Failed to export ${table}:`, error);
      results[table] = -1;
    }
  }

  console.log('Data export complete:', results);
  return { tables: results };
};
