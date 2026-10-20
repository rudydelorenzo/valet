import { z } from "zod";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { listEnvironments } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { EnvironmentSchema } from "@/types";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";
import type { Environment } from "@/types";

const EnvironmentsSchema = z.array(EnvironmentSchema);

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Environment[] | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  try {
    const environments = await listEnvironments(
      instance.url,
      instance.token,
      instance.insecureTls,
    );
    return json(EnvironmentsSchema, environments);
  } catch (err) {
    return json(
      ApiErrorSchema,
      { error: err instanceof Error ? err.message : "Failed to list environments" },
      { status: 502 },
    );
  }
};
