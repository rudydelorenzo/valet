import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/lib/db";

/** Apply pending DB migrations. Called once at startup (instrumentation.ts). */
export const runMigrations = (migrationsFolder = "./drizzle"): void => {
  migrate(db, { migrationsFolder });
};
