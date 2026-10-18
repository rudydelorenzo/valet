import { db } from "@/lib/db";
import { webhooks, portainerInstances } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { DEFAULT_DEBOUNCE_SECONDS } from "@/lib/constants";
import crypto from "node:crypto";

export const GET = async () => {
  const rows = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      token: webhooks.token,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      stackName: webhooks.stackName,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
      createdAt: webhooks.createdAt,
      instanceName: portainerInstances.name,
    })
    .from(webhooks)
    .leftJoin(
      portainerInstances,
      eq(webhooks.portainerInstanceId, portainerInstances.id),
    )
    .orderBy(desc(webhooks.createdAt));

  return Response.json(rows);
};

export const POST = async (request: Request) => {
  const body = await request.json();
  const {
    name,
    portainerInstanceId,
    stackId,
    endpointId,
    stackName,
    debounceSeconds,
  } = body as {
    name?: string;
    portainerInstanceId?: string;
    stackId?: number;
    endpointId?: number;
    stackName?: string;
    debounceSeconds?: number;
  };

  if (!name || !portainerInstanceId || stackId == null || endpointId == null || !stackName) {
    return Response.json(
      {
        error:
          "name, portainerInstanceId, stackId, endpointId, and stackName are required",
      },
      { status: 400 },
    );
  }

  // Generate a random token for the webhook URL
  const token = crypto.randomBytes(32).toString("base64url");

  const [webhook] = await db
    .insert(webhooks)
    .values({
      name,
      token,
      portainerInstanceId,
      stackId,
      endpointId,
      stackName,
      debounceSeconds: debounceSeconds ?? DEFAULT_DEBOUNCE_SECONDS,
    })
    .returning();

  return Response.json(webhook, { status: 201 });
};