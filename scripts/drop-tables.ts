import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL!);

async function dropAllTables() {
  try {
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
    console.log('All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    process.exit(1);
  }
}

dropAllTables();
