import { z } from "zod";
import {
  listWebhooksByUser,
  createWebhook,
  getWebhookHealth,
  computeWebhookStatus,
} from "@/lib/db/webhooks";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { requireAuth } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import { CreatedWebhookSchema, WebhookSchema } from "@/types";
import {
  ApiErrorSchema,
  CreateWebhookSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { CreatedWebhook, Webhook } from "@/types";

const WebhooksSchema = z.array(WebhookSchema);

export const GET = async (): Promise<NextResponse<Webhook[]>> => {
  const userId = await requireAuth();
  const rows = await listWebhooksByUser(userId);
  const health = await getWebhookHealth(rows.map((w) => w.id));

  return json(
    WebhooksSchema,
    rows.map((w) => {
      const h = health.get(w.id);
      const degraded = h?.degraded ?? false;
      return {
        ...w,
        status: computeWebhookStatus(w.enabled, degraded),
        eventsTotal: h?.total ?? 0,
        eventsFailed: h?.failed ?? 0,
      };
    }),
  );
};

export const POST = async (
  request: Request,
): Promise<NextResponse<CreatedWebhook | ApiError>> => {
  const userId = await requireAuth();

  const body = await parseBody(request, CreateWebhookSchema);
  if (body instanceof NextResponse) return body;
  const { name, portainerInstanceId, stackId, endpointId, debounceSeconds } = body;

  // Verify the instance belongs to this user
  const instance = await getPortainerInstance(portainerInstanceId);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Instance not found" }, { status: 404 });
  }

  const webhook = await createWebhook({
    userId,
    name,
    portainerInstanceId,
    stackId,
    endpointId,
    debounceSeconds,
  });

  // token is intentional here — the caller needs the deploy URL
  return json(CreatedWebhookSchema, webhook, { status: 201 });
};
