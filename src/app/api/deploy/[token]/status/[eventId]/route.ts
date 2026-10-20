import { NextRequest, NextResponse } from "next/server";
import { getWebhookByToken } from "@/lib/db/webhooks";
import { getWebhookEvent } from "@/lib/db/webhook-events";

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
) {
  const { token, eventId } = await params;

  const webhook = await getWebhookByToken(token);
  if (!webhook) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const event = await getWebhookEvent(eventId, webhook.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isPlainText = request.headers.get("accept")?.includes("text/plain");
  const body = isPlainText
    ? event.status
    : { status: event.status, message: event.message ?? undefined };

  const statusCode =
    event.status === "success"
      ? 200
      : event.status === "error"
        ? 502
        : 202; // queued or running

  return new NextResponse(isPlainText ? event.status : JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": isPlainText ? "text/plain; charset=utf-8" : "application/json",
      "Cache-Control": "no-store",
    },
  });
}