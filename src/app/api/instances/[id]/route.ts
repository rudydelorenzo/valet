import {
  deletePortainerInstance,
  getPortainerInstance,
  toPublicInstance,
  updatePortainerInstance,
} from "@/lib/db/portainer-instances";
import { requireAuth } from "@/lib/auth/guard";
import { validateInstance } from "@/lib/portainer";
import { json, parseBody } from "@/lib/http";
import { InstanceSchema } from "@/types";
import {
  ApiErrorSchema,
  OkSchema,
  UpdateInstanceSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { Instance } from "@/types";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Instance | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  // Never expose the access token — the schema strips it at the boundary
  return json(InstanceSchema, toPublicInstance(instance));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const current = await getPortainerInstance(id);

  if (!current || current.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(request, UpdateInstanceSchema);
  if (body instanceof NextResponse) return body;

  const updates: {
    name?: string;
    url?: string;
    token?: string;
    insecureTls?: boolean;
  } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.token !== undefined) updates.token = body.token;
  if (body.insecureTls !== undefined) updates.insecureTls = body.insecureTls;

  // If URL or token changed, validate the new connection
  if (updates.url || updates.token) {
    const validation = await validateInstance(
      updates.url ?? current.url,
      updates.token ?? current.token,
      updates.insecureTls ?? current.insecureTls,
    );

    if (!validation.ok) {
      return json(ApiErrorSchema, { error: validation.error }, { status: 400 });
    }
  }

  const updated = await updatePortainerInstance(id, updates);

  if (!updated) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  return json(OkSchema, { ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  await deletePortainerInstance(id);

  return json(OkSchema, { ok: true });
};
