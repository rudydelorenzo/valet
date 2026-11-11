import { NextRequest, NextResponse } from "next/server";
import { getWebhookByToken } from "@/lib/db/webhooks";
import { getWebhookEvent } from "@/lib/db/webhook-events";
import { listEventStepsForEvent } from "@/lib/db/webhook-event-steps";
import { getEventMessage } from "@/lib/webhook-events";
import { json } from "@/lib/http";
import { TERMINAL_STATE } from "@/lib/constants";
import { statusFromSteps } from "@/lib/worker/jobs/deploy/state";
import {
  ApiErrorSchema,
  DeployStatusSchema,
  type ApiError,
  type DeployStatus,
} from "@/types/api";

/**
 * GET /api/deploy/[token]/status/[eventId]
 *
 * CLI-friendly deploy status endpoint.
 *
 * - `Accept: text/plain` → returns just the status string (queued, running, success, error)
 * - Otherwise → returns `{ status, message? }`
 *
 * HTTP status codes reflect deploy state:
 * - 200 → success
 * - 202 → queued or running (still in progress)
 * - 502 → error
 * - 404 → webhook or event not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; eventId: string }> },
): Promise<NextResponse<DeployStatus | ApiError | string>> {
  const { token, eventId } = await params;

  const webhook = await getWebhookByToken(token);
  if (!webhook) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const event = await getWebhookEvent(eventId, webhook.id);
  if (!event) {
    return json(ApiErrorSchema, { error: "Event not found" }, { status: 404 });
  }

  // State lives in the step log — the status is its projection, and the
  // outcome message rides on the terminal row.
  const status = statusFromSteps(await listEventStepsForEvent(event.id));
  const message = (await getEventMessage(event.id)) ?? undefined;

  const statusCode =
    status === TERMINAL_STATE.SUCCESS
      ? 200
      : status === TERMINAL_STATE.ERROR
        ? 502
        : 202; // queued or running

  const isPlainText = request.headers.get("accept")?.includes("text/plain");
  if (isPlainText) {
    return new NextResponse(status, {
      status: statusCode,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return json(
    DeployStatusSchema,
    { status, message },
    {
      status: statusCode,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
