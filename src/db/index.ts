import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined;
}

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!global._pgClient) {
    // max: 3 per serverless function instance — Neon's pooler (pgBouncer) handles
    // global concurrency, so we can safely allow a few connections per lambda.
    // idle_timeout: release connections quickly between serverless invocations.
    global._pgClient = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
  }
  return global._pgClient;
}

export const db = drizzle(getClient(), { schema });
export type DB = typeof db;
