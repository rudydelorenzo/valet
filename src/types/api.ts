/**
 * API-surface schemas — narrow contracts for specific endpoints.
 *
 * Zod schemas are the source of truth: the exported types are inferred
 * from them. Broad application models live in @/types.
 */
import { z } from "zod";

// ── Shared response shapes ─────────────────────────────────────────

/** Standard error body returned by API routes. */
export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Standard success body for destructive/patch operations. */
export const OkSchema = z.object({ ok: z.boolean() });

/** Result of triggering a deploy (POST /api/webhooks/[id]/trigger). */
export const DeployResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  eventId: z.string(),
});

// ── Deploy contract (the CI-facing endpoints under /api/deploy) ────

/** Response to a deploy trigger (POST /api/deploy/[token]). */
export const DeployReceiptSchema = z.object({
  received: z.literal(true),
  eventId: z.string(),
  deployUrl: z.string(),
  statusUrl: z.string(),
  eventUrl: z.string(),
});
export type DeployReceipt = z.infer<typeof DeployReceiptSchema>;

/** JSON form of GET /api/deploy/[token]/status/[eventId] (text/plain is the other form). */
export const DeployStatusSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
});
export type DeployStatus = z.infer<typeof DeployStatusSchema>;

// ── Session & setup status ─────────────────────────────────────────

export const SessionStatusSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      isAdmin: z.boolean(),
    }),
  }),
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SetupStatusSchema = z.discriminatedUnion("configured", [
  z.object({ configured: z.literal(true) }),
  z.object({ configured: z.literal(false), verified: z.boolean() }),
]);
export type SetupStatus = z.infer<typeof SetupStatusSchema>;

/** Health probe (GET /api/healthz) — 200 ok / 503 unavailable. */
export const HealthSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
});
export type HealthResponse = z.infer<typeof HealthSchema>;

/**
 * Result of pinging a Portainer instance's /api/status.
 * GET /api/instances/reachability → { results: Record<id, ReachabilityResult> }.
 */
export const ReachabilityResultSchema = z.object({
  reachable: z.boolean(),
  version: z.string().optional(),
});
export type ReachabilityResult = z.infer<typeof ReachabilityResultSchema>;

/** Health status of a webhook, from its enabled flag and 24h failure rate. */
export const WebhookStatusSchema = z.enum(["active", "disabled", "degraded"]);
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;

// ── Request bodies ─────────────────────────────────────────────────

const name = z.string().trim().min(1, "name is required");

export const CreateWebhookSchema = z.object({
  name,
  portainerInstanceId: z.string().min(1, "portainerInstanceId is required"),
  stackId: z.number().int().min(0, "stackId must be a non-negative integer"),
  endpointId: z.number().int().min(0, "endpointId must be a non-negative integer"),
  debounceSeconds: z
    .number()
    .int("debounceSeconds must be an integer between 0 and 86400")
    .min(0, "debounceSeconds must be an integer between 0 and 86400")
    .max(86400, "debounceSeconds must be an integer between 0 and 86400")
    .optional(),
});

export const UpdateWebhookSchema = z
  .object({
    name: name.optional(),
    enabled: z.boolean().optional(),
    debounceSeconds: z
      .number()
      .int("debounceSeconds must be an integer between 0 and 86400")
      .min(0, "debounceSeconds must be an integer between 0 and 86400")
      .max(86400, "debounceSeconds must be an integer between 0 and 86400")
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "No valid fields to update");

export const CreateInstanceSchema = z.object({
  name,
  url: z.string().min(1, "url is required"),
  token: z.string().min(1, "token is required"),
  insecureTls: z.boolean().optional(),
});

export const UpdateInstanceSchema = z.object({
  name: name.optional(),
  url: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  insecureTls: z.boolean().optional(),
});

export const CreateProviderSchema = z.object({
  name,
  issuer: z.string().min(1, "issuer is required"),
  clientId: z.string().min(1, "clientId is required"),
  clientSecret: z.string().min(1, "clientSecret is required"),
  scopes: z.string().optional(),
  skipEmailVerification: z.boolean().optional(),
});

export const UpdateProviderSchema = z.object({
  name: name.optional(),
  issuer: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  scopes: z.string().optional(),
  skipEmailVerification: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const UpdateUserSchema = z.object({
  isAdmin: z.boolean(),
});

export const SetupCodeSchema = z.object({
  code: z.string().min(1, "code is required"),
});
