import { readFileSync } from "node:fs";
import { db } from "@/lib/db";

interface JournalFile {
  entries: Array<unknown>;
}

/**
 * Readiness probe: the database responds, and every migration recorded
 * in the drizzle journal has been applied. Used by /api/healthz.
 */
export const checkDatabaseHealth = (): boolean => {
  try {
    const ping = db.get<{ ok: number }>("SELECT 1 AS ok");
    if (ping?.ok !== 1) return false;

    const journal = JSON.parse(
      readFileSync("./drizzle/meta/_journal.json", "utf8"),
    ) as JournalFile;

    const { count } = db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM __drizzle_migrations",
    );
    return count === journal.entries.length;
  } catch {
    return false;
  }
};
