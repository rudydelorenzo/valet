export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerEventHandler, startWorker } = await import("./lib/worker");
    const { consumeDeployEvent } = await import("./lib/worker/jobs/deploy");
    registerEventHandler("deploy", consumeDeployEvent);
    startWorker();
  }
}