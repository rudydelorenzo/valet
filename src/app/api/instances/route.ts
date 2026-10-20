import { NextResponse } from "next/server";
import {
  createPortainerInstance,
  listPortainerInstancesByUser,
  toPublicInstance,
} from "@/lib/db/portainer-instances";
import { validateInstance } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";
import type { Instance } from "@/lib/db/types";
import type { ApiError } from "@/types/api";

export const GET = async (): Promise<NextResponse<Instance[]>> => {
  const userId = await requireAuth();

  const instances = await listPortainerInstancesByUser(userId);

  return NextResponse.json(instances.map(toPublicInstance));
};

export const POST = async (
  request: Request,
): Promise<NextResponse<Instance | ApiError>> => {
  const userId = await requireAuth();

  const body = await request.json();
  const { name, url, token, insecureTls } = body as {
    name?: string;
    url?: string;
    token?: string;
    insecureTls?: boolean;
  };

  if (!name || !url || !token) {
    return NextResponse.json(
      { error: "name, url, and token are required" },
      { status: 400 },
    );
  }

  // Verify URL points to Portainer and token works
  const validation = await validateInstance(url, token, insecureTls ?? false);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const instance = await createPortainerInstance({
    userId,
    name,
    url,
    token,
    insecureTls: insecureTls ?? false,
  });

  // Never expose the access token — the handler's return type enforces
  // the public shape
  return NextResponse.json(toPublicInstance(instance), { status: 201 });
};
