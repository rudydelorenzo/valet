/**
 * API response/request helpers.
 *
 * json() serializes every response through a zod schema: unknown keys
 * are stripped (so secrets can never leak unless a schema explicitly
 * declares them), and a parse failure is a bug in the route — it is
 * logged loudly and fails the request.
 */
import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { ApiErrorSchema, type ApiError } from "@/types/api";

/** Serialize an API response through a schema. */
export const json = <S extends ZodType>(
  schema: S,
  body: z.input<S>,
  init?: ResponseInit,
): NextResponse<z.output<S>> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(
      "[api] response failed schema validation (this is a bug):",
      formatError(parsed.error),
    );
    throw new Error("API response failed schema validation");
  }
  return NextResponse.json(parsed.data, init); // eslint-disable-line no-restricted-syntax -- the one sanctioned serialization point
};

/**
 * Parse and validate a JSON request body.
 * Returns the parsed body, or a 400 ApiError response to return as-is.
 */
export const parseBody = async <S extends ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S> | NextResponse<ApiError>> => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(ApiErrorSchema, { error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return json(
      ApiErrorSchema,
      { error: formatError(parsed.error) },
      { status: 400 },
    );
  }
  return parsed.data;
};

/** Compact one-line rendering of validation issues, e.g. "name: Required". */
const formatError = (error: z.ZodError): string =>
  error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
