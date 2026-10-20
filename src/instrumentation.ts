export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Apply pending DB migrations
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { db } = await import("./lib/db");
    migrate(db, { migrationsFolder: "./drizzle" });

    // Start the background worker
    const { registerEventHandler, startWorker } = await import("./lib/worker");
    const { consumeDeployEvent } = await import("./lib/worker/jobs/deploy");
    registerEventHandler("deploy", consumeDeployEvent);
    startWorker();
  }
}