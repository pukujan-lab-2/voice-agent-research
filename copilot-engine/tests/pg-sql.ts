// A real Postgres engine (PGlite, in-process) behind the same `sql(text, params)` shape the Octo workspace SQL surface
// has, so the Octo-backed store is tested against actual SQL and not a mock.
import { PGlite } from '@electric-sql/pglite';
import type { Sql } from '../src/octo-store.ts';

export async function pgSql(): Promise<{ sql: Sql; db: PGlite }> {
  const db = new PGlite();
  await db.waitReady;
  return { db, sql: async (text, params) => (await db.query(text, params)).rows as Record<string, unknown>[] };
}
