import { env } from 'cloudflare:workers';
export function database(): D1Database {
  if (!env.DB) throw new Error('Storage unavailable');
  // Primary reads avoid stale pair/token state when D1 read replication is enabled.
  return env.DB;
}
