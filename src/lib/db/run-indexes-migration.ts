import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🔄 STARTING INDEXES MIGRATION...');
  const sqlFilePath = path.join(__dirname, 'add-dashboard-indexes.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ Migration SQL file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  const client = postgres(connectionString!, { max: 1 });

  try {
    console.log('Executing SQL statements...');
    // postgres-js allows multi-statement execute by passing raw sql string
    await client.unsafe(sqlContent);
    console.log('✅ DATABASE INDEXES COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
