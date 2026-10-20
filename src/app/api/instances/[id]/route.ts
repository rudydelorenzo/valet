import { NextResponse } from "next/server";
import {
  deletePortainerInstance,
  getPortainerInstance,
  toPublicInstance,
  updatePortainerInstance,
} from "@/lib/db/portainer-instances";
import { requireAuth } from "@/lib/auth/guard";
import { validateInstance } from "@/lib/portainer";
import type { Instance } from "@/lib/db/types";
import type { ApiError } from "@/types/api";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Instance | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never expose the access token — the handler's return type enforces
  // the public shape
  return NextResponse.json(toPublicInstance(instance));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const current = await getPortainerInstance(id);

  if (!current || current.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const updated = await updatePortainerInstance(id, updates);

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deletePortainerInstance(id);

  return NextResponse.json({ ok: true });
};
