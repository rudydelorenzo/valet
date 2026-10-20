import {
  listWebhooksByUser,
  createWebhook,
  getWebhookHealth,
  computeWebhookStatus,
} from "@/lib/db/webhooks";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { requireAuth } from "@/lib/auth/guard";

export const GET = async () => {
  const userId = await requireAuth();
  const rows = await listWebhooksByUser(userId);
  const health = await getWebhookHealth(rows.map((w) => w.id));

  return Response.json(
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

export const POST = async (request: Request) => {
  const userId = await requireAuth();

  const body = await request.json();
  const {
    name,
    portainerInstanceId,
    stackId,
    endpointId,
    debounceSeconds,
  } = body as {
    name?: unknown;
    portainerInstanceId?: unknown;
    stackId?: unknown;
    endpointId?: unknown;
    debounceSeconds?: unknown;
  };

  // Validate required fields
  if (
    typeof name !== "string" || name.trim().length === 0 ||
    typeof portainerInstanceId !== "string" ||
    !Number.isInteger(stackId) || (stackId as number) < 0 ||
    !Number.isInteger(endpointId) || (endpointId as number) < 0
  ) {
    return Response.json(
      {
        error:
          "name (string), portainerInstanceId (string), stackId (integer), and endpointId (integer) are required",
      },
      { status: 400 },
    );
  }

  // Validate optional debounceSeconds
  if (
    debounceSeconds !== undefined &&
    (!Number.isInteger(debounceSeconds) || (debounceSeconds as number) < 0 || (debounceSeconds as number) > 86400)
  ) {
    return Response.json(
      { error: "debounceSeconds must be an integer between 0 and 86400" },
      { status: 400 },
    );
  }

  // Verify the instance belongs to this user
  const instance = await getPortainerInstance(portainerInstanceId as string);

  if (!instance || instance.userId !== userId) {
    return Response.json(
      { error: "Instance not found" },
      { status: 404 },
    );
  }

  const webhook = await createWebhook({
    userId,
    name: (name as string).trim(),
    portainerInstanceId: portainerInstanceId as string,
    stackId: stackId as number,
    endpointId: endpointId as number,
    debounceSeconds: (debounceSeconds as number | undefined),
  });

  return Response.json(webhook, { status: 201 });
};