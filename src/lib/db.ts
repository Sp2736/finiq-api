import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'CRITICAL SECURITY ERROR: DATABASE_URL environment variable is missing. ' +
      'Database connections are blocked.',
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Standard for cloud PostgreSQL databases
  },
});

export default pool;
