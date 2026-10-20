import { z } from "zod";
import {
  createProvider,
  listProviders,
  toPublicProvider,
} from "@/lib/db/oidc-providers";
import { discover } from "@/lib/auth/oidc";
import { requireAdmin } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import { OidcProviderSchema } from "@/types";
import {
  ApiErrorSchema,
  CreateProviderSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { OidcProvider } from "@/types";

const OidcProvidersSchema = z.array(OidcProviderSchema);

export const GET = async (): Promise<NextResponse<OidcProvider[]>> => {
  await requireAdmin();
  const providers = await listProviders();

  // Never expose the client secret — the schema strips it at the boundary
  return json(OidcProvidersSchema, providers.map(toPublicProvider));
};

export const POST = async (
  request: Request,
): Promise<NextResponse<OidcProvider | ApiError>> => {
  await requireAdmin();
  const body = await parseBody(request, CreateProviderSchema);
  if (body instanceof NextResponse) return body;
  const { name, issuer, clientId, clientSecret, scopes, skipEmailVerification } = body;

  // Validate that the issuer is a real OIDC provider
  try {
    await discover(issuer);
  } catch {
    return json(
      ApiErrorSchema,
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

  // Never expose the client secret — the schema strips it at the boundary
  return json(OidcProviderSchema, toPublicProvider(provider), { status: 201 });
};
