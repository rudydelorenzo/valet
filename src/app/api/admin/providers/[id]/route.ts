import { NextResponse } from "next/server";
import {
  deleteProvider,
  getProvider,
  toPublicProvider,
  updateProvider,
} from "@/lib/db/oidc-providers";
import { discover } from "@/lib/auth/oidc";
import type { OidcProvider } from "@/lib/db/types";
import type { ApiError } from "@/types/api";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<OidcProvider | ApiError>> => {
  const { id } = await params;
  const provider = await getProvider(id);

  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never expose the client secret — the handler's return type enforces
  // the public shape
  return NextResponse.json(toPublicProvider(provider));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const { id } = await params;
  const body = await request.json();
  const updates: {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
    skipEmailVerification?: boolean;
    enabled?: boolean;
  } = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.issuer !== undefined) updates.issuer = body.issuer;
  if (body.clientId !== undefined) updates.clientId = body.clientId;
  if (body.clientSecret !== undefined) updates.clientSecret = body.clientSecret;
  if (body.scopes !== undefined) updates.scopes = body.scopes;
  if (body.skipEmailVerification !== undefined) updates.skipEmailVerification = body.skipEmailVerification;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  // Validate issuer if changed
  if (updates.issuer) {
    try {
      await discover(updates.issuer);
    } catch {
      return NextResponse.json(
        { error: "Could not discover OIDC endpoints at the given issuer URL" },
        { status: 400 },
      );
    }
  }

  const updated = await updateProvider(id, updates);

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const { id } = await params;
  const deleted = await deleteProvider(id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
};
