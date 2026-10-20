import {
  claimNextEvent,
  setEventStatus,
  cleanupStaleEvents,
} from "@/lib/db/webhook-events";
import type { WebhookEvent } from "@/lib/db/webhook-events";

// ── Types ─────────────────────────────────────────────────────────

export type EventHandler = (
  event: WebhookEvent,
) => Promise<{ success: boolean; message: string }>;

// ── State ─────────────────────────────────────────────────────────

declare global {
  var __valetWorkerRunning: boolean | undefined;
  var __valetWorkerHandlers: Map<string, EventHandler> | undefined;
}

let running: boolean = (globalThis.__valetWorkerRunning ??= false);
const handlers: Map<string, EventHandler> = (globalThis.__valetWorkerHandlers ??= new Map());

const POLL_MS = 1_000;
const IDLE_TIMEOUT_MS = 30_000;

// ── Public API ────────────────────────────────────────────────────

/** Register a job handler for an event type. Call once at startup. */
export const registerEventHandler = (type: string, handler: EventHandler): void => {
  handlers.set(type, handler);
};

/**
 * Start the background worker. No-op if already running.
 * Call from instrumentation.ts at startup and from route handlers as a safety net.
 */
export const startWorker = (): void => {
  if (running) return;
  if (handlers.size === 0) throw new Error("No handlers registered — call registerHandler() first");
  running = true;
  console.info(`[Worker] Starting with ${handlers.size} registered handler(s): [${[...handlers.keys()].join(", ")}]`);

  loop()
    .catch((err) => {
      console.error("[Worker] Crashed unexpectedly:", err);
    })
    .finally(() => {
      running = false;
      console.info("[Worker] Loop ended, worker stopped");
    });
};

/** Alias — makes intent clearer in route handlers. */
export const ensureWorker = startWorker;

// ── Loop ──────────────────────────────────────────────────────────

const loop = async (): Promise<void> => {
  console.info("[Worker] Starting event loop");
  try {
    await cleanupStaleEvents(new Date(Date.now() - 10 * 60 * 1000));
    console.info("[Worker] Stale event cleanup completed");
  } catch (err) {
    console.error("[Worker] Failed to clean up stale events:", err);
  }

  let lastActivity = Date.now();

  while (true) {
    try {
      const event = await claimNextEvent();

      if (!event) {
        if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
          console.info("[Worker] Idle timeout reached, shutting down loop");
          break;
        }
        await sleep(POLL_MS);
        continue;
      }

      console.info(`[Worker] Claimed event ${event.id} (type=${event.type}, webhook=${event.webhookId}, source=${event.triggerSource})`);
      lastActivity = Date.now();
      await processEvent(event);
    } catch (err) {
      console.error("[Worker] Unexpected error in loop iteration:", err);
      await sleep(POLL_MS);
    }
  }
};

// ── Event processing ──────────────────────────────────────────────

const processEvent = async (event: WebhookEvent): Promise<void> => {
  const handler = handlers.get(event.type);

  if (!handler) {
    console.warn(`[Worker] No handler registered for type "${event.type}" on event ${event.id}, marking as error`);
    try {
      await setEventStatus(event.id, "error", `No handler registered for type "${event.type}"`);
    } catch (err) {
      console.error(`[Worker] Failed to update event ${event.id}:`, err);
    }
    return;
  }

  console.info(`[Worker] Processing event ${event.id} with handler "${event.type}"`);
  const startedAt = Date.now();
  let result: { success: boolean; message: string };

  try {
    result = await handler(event);
  } catch (err) {
    console.error(`[Worker] Handler "${event.type}" crashed for event ${event.id}:`, err);
    result = {
      success: false,
      message: `Handler crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const elapsed = Date.now() - startedAt;

  try {
    await setEventStatus(
      event.id,
      result.success ? "success" : "error",
      result.message,
    );
    console.info(`[Worker] Event ${event.id} finished: ${result.success ? "success" : "error"} (${elapsed}ms) — ${result.message}`);
  } catch (err) {
    console.error(`[Worker] Failed to update event ${event.id}:`, err);
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));