import { z } from "zod";
import {
  createPortainerInstance,
  listPortainerInstancesByUser,
  toPublicInstance,
} from "@/lib/db/portainer-instances";
import { validateInstance } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import { InstanceSchema } from "@/types";
import {
  ApiErrorSchema,
  CreateInstanceSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { Instance } from "@/types";

const InstancesSchema = z.array(InstanceSchema);

export const GET = async (): Promise<NextResponse<Instance[]>> => {
  const userId = await requireAuth();

  const instances = await listPortainerInstancesByUser(userId);

  return json(InstancesSchema, instances.map(toPublicInstance));
};

export const POST = async (
  request: Request,
): Promise<NextResponse<Instance | ApiError>> => {
  const userId = await requireAuth();

  const body = await parseBody(request, CreateInstanceSchema);
  if (body instanceof NextResponse) return body;
  const { name, url, token, insecureTls } = body;

  // Verify URL points to Portainer and token works
  const validation = await validateInstance(url, token, insecureTls ?? false);
  if (!validation.ok) {
    return json(ApiErrorSchema, { error: validation.error }, { status: 400 });
  }

  const instance = await createPortainerInstance({
    userId,
    name,
    url,
    token,
    insecureTls: insecureTls ?? false,
  });

  // Never expose the access token — the schema strips it at the boundary
  return json(InstanceSchema, toPublicInstance(instance), { status: 201 });
};
