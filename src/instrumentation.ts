export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Apply pending DB migrations
    const { runMigrations } = await import("./lib/db/migrate");
    runMigrations();

    // Recover events orphaned by a previous process death. Runs once per
    // boot, before the worker starts, so nothing can be in flight yet.
    const { requeueInterrupted } = await import("./lib/helpers/webhook-events");
    await requeueInterrupted();

    // Start the background worker
    const { registerEventHandler, startWorker } = await import("./lib/worker");
    const { consumeDeployEvent } = await import("./lib/worker/jobs/deploy");
    registerEventHandler("deploy", consumeDeployEvent);
    startWorker();
  }
}