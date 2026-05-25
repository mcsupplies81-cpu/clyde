import { drizzle } from 'drizzle-orm/neon-http';

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return drizzle(url);
}
