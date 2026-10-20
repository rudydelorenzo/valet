export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Apply pending DB migrations
    const { runMigrations } = await import("./lib/db/migrate");
    runMigrations();

    // Start the background worker
    const { registerEventHandler, startWorker } = await import("./lib/worker");
    const { consumeDeployEvent } = await import("./lib/worker/jobs/deploy");
    registerEventHandler("deploy", consumeDeployEvent);
    startWorker();
  }
}