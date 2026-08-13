import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error('NEON_DATABASE_URL is not set');

export const sql = neon(connectionString);
