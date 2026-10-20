import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookHealth,
  computeWebhookStatus,
} from "@/lib/db/webhooks";
import { requireAuth } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import { WebhookDetailSchema } from "@/types";
import {
  ApiErrorSchema,
  OkSchema,
  UpdateWebhookSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { WebhookDetail } from "@/types";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<WebhookDetail | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const health = await getWebhookHealth([id]);
  const h = health.get(id);

  // token is intentional here — the deploy URL the user copies embeds it
  return json(WebhookDetailSchema, {
    ...webhook,
    status: computeWebhookStatus(webhook.enabled, h?.degraded ?? false),
    eventsTotal: h?.total ?? 0,
    eventsFailed: h?.failed ?? 0,
  });
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(request, UpdateWebhookSchema);
  if (body instanceof NextResponse) return body;

  await updateWebhook(id, body);

  return json(OkSchema, { ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  await deleteWebhook(id);

  return json(OkSchema, { ok: true });
};
