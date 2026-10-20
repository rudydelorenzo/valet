import {
  deleteProvider,
  getProvider,
  toPublicProvider,
  updateProvider,
} from "@/lib/db/oidc-providers";
import { discover } from "@/lib/auth/oidc";
import { requireAdmin } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import { OidcProviderSchema } from "@/types";
import {
  ApiErrorSchema,
  OkSchema,
  UpdateProviderSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { OidcProvider } from "@/types";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<OidcProvider | ApiError>> => {
  await requireAdmin();
  const { id } = await params;
  const provider = await getProvider(id);

  if (!provider) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  // Never expose the client secret — the schema strips it at the boundary
  return json(OidcProviderSchema, toPublicProvider(provider));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  await requireAdmin();
  const { id } = await params;

  const body = await parseBody(request, UpdateProviderSchema);
  if (body instanceof NextResponse) return body;

  // Validate issuer if changed
  if (body.issuer) {
    try {
      await discover(body.issuer);
    } catch {
      return json(
        ApiErrorSchema,
        { error: "Could not discover OIDC endpoints at the given issuer URL" },
        { status: 400 },
      );
    }
  }

  const updated = await updateProvider(id, body);

  if (!updated) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  return json(OkSchema, { ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  await requireAdmin();
  const { id } = await params;
  const deleted = await deleteProvider(id);

  if (!deleted) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  return json(OkSchema, { ok: true });
};
