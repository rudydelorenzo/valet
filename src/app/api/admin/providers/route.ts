import { NextResponse } from "next/server";
import {
  createProvider,
  listProviders,
  toPublicProvider,
} from "@/lib/db/oidc-providers";
import { discover } from "@/lib/auth/oidc";
import type { OidcProvider } from "@/lib/db/types";
import type { ApiError } from "@/types/api";

export const GET = async (): Promise<NextResponse<OidcProvider[]>> => {
  const providers = await listProviders();

  // Never expose the client secret — the handler's return type enforces
  // the public shape
  return NextResponse.json(providers.map(toPublicProvider));
};

export const POST = async (
  request: Request,
): Promise<NextResponse<OidcProvider | ApiError>> => {
  const body = await request.json();
  const { name, issuer, clientId, clientSecret, scopes, skipEmailVerification } = body as {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
    skipEmailVerification?: boolean;
  };

  if (!name || !issuer || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "name, issuer, clientId, and clientSecret are required" },
      { status: 400 },
    );
  }

  // Validate that the issuer is a real OIDC provider
  try {
    await discover(issuer);
  } catch {
    return NextResponse.json(
      { error: "Could not discover OIDC endpoints at the given issuer URL" },
      { status: 400 },
    );
  }

  const provider = await createProvider({
    name,
    issuer,
    clientId,
    clientSecret,
    scopes,
    skipEmailVerification: skipEmailVerification ?? false,
  });

  // Never expose the client secret — the handler's return type enforces
  // the public shape
  return NextResponse.json(toPublicProvider(provider), { status: 201 });
};
