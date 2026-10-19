import {
  claimNextEvent,
  setEventStatus,
  cleanupStaleEvents,
} from "@/lib/db/webhook-events";
import type { WebhookEvent } from "@/lib/db/schema";

// ── Types ─────────────────────────────────────────────────────────

export type EventHandler = (
  event: WebhookEvent,
) => Promise<{ success: boolean; message: string }>;

// ── State ─────────────────────────────────────────────────────────

declare global {
  var __valetWorkerRunning: boolean | undefined;
}

let running: boolean = (globalThis.__valetWorkerRunning ??= false);

const handlers = new Map<string, EventHandler>();

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

  loop()
    .catch((err) => {
      console.error("Worker crashed unexpectedly:", err);
    })
    .finally(() => {
      running = false;
    });
};

/** Alias — makes intent clearer in route handlers. */
export const ensureWorker = startWorker;

// ── Loop ──────────────────────────────────────────────────────────

const loop = async (): Promise<void> => {
  try {
    await cleanupStaleEvents(new Date(Date.now() - 10 * 60 * 1000));
  } catch (err) {
    console.error("Worker: failed to clean up stale events:", err);
  }

  let lastActivity = Date.now();

  while (true) {
    try {
      const event = await claimNextEvent();

      if (!event) {
        if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) break;
        await sleep(POLL_MS);
        continue;
      }

      lastActivity = Date.now();
      await processEvent(event);
    } catch (err) {
      console.error("Worker: unexpected error in loop iteration:", err);
      await sleep(POLL_MS);
    }
  }
};

// ── Event processing ──────────────────────────────────────────────

const processEvent = async (event: WebhookEvent): Promise<void> => {
  const handler = handlers.get(event.type);

  if (!handler) {
    try {
      await setEventStatus(event.id, "error", `No handler registered for type "${event.type}"`);
    } catch (err) {
      console.error(`Worker: failed to update event ${event.id}:`, err);
    }
    return;
  }

  let result: { success: boolean; message: string };

  try {
    result = await handler(event);
  } catch (err) {
    result = {
      success: false,
      message: `Handler crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    await setEventStatus(
      event.id,
      result.success ? "success" : "error",
      result.message,
    );
  } catch (err) {
    console.error(`Worker: failed to update event ${event.id}:`, err);
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));