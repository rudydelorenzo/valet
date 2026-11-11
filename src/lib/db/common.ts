import { db, type DbExecutor } from "@/lib/db";

/**
 * Run a multi-statement write atomically — the composition primitive the
 * use-case layer (src/lib/webhook-events.ts) builds on, since accessor
 * modules are the only sanctioned home for the db handle.
 *
 * The callback must be SYNCHRONOUS: better-sqlite3 executes transactions
 * on one connection in a single tick and rejects promise-returning
 * callbacks ("Transaction function cannot return a promise"). Accessors
 * composed inside use the sync terminal methods (.run/.get/.all).
 * To expose a Promise API to callers, wrap the call in an async function
 * (the transaction itself stays synchronous).
 */
export const withTransaction = <T>(fn: (tx: DbExecutor) => T): T =>
  db.transaction((tx) => fn(tx));
