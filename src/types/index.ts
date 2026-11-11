/**
 * Application shapes — what this app passes between its API routes and
 * the frontend. Zod schemas are the source of truth: the exported types
 * are inferred from them.
 *
 * These are JSON-serialized, secret-free views of the DB rows (whose
 * types live in @/lib/db/schema, internal to the data layer). Response
 * routes must serialize through these schemas (see json() in @/lib/http)
 * so unknown keys — secrets included — are stripped at the API boundary.
 *
 * Endpoint-specific API contract types live in @/types/api. Portainer's
 * own API shapes live in @/lib/portainer, except shapes shared with other
 * layers (the deployment journal) which live here.
 */
import { z } from "zod";
import { WebhookStatusSchema } from "@/types/api";
import { EVENT_STATES, EVENT_STEPS } from "@/lib/constants";

/**
 * Accepts a Date (fresh from the DB layer) or an ISO string (already
 * serialized), and normalizes to the ISO string seen over the wire.
 */
const timestamp = z
  .union([z.date(), z.string()])
  .transform((value) => (typeof value === "string" ? value : value.toISOString()));

// ── Users ──────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isAdmin: z.boolean(),
  createdAt: timestamp,
});
export type User = z.infer<typeof UserSchema>;

// ── Instances ──────────────────────────────────────────────────────

/** A Portainer instance, as exposed over the API (never includes the token). */
export const InstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  insecureTls: z.boolean(),
  /** Whether an access token is stored for this instance. */
  hasToken: z.boolean(),
  createdAt: timestamp,
});
export type Instance = z.infer<typeof InstanceSchema>;

// ── OIDC providers ─────────────────────────────────────────────────

/** An OIDC provider, as exposed over the API (never includes the client secret). */
export const OidcProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  clientId: z.string(),
  scopes: z.string(),
  skipEmailVerification: z.boolean(),
  enabled: z.boolean(),
  createdAt: timestamp,
});
export type OidcProvider = z.infer<typeof OidcProviderSchema>;

/** Minimal provider shape exposed on the login page (never secrets). */
export const ProviderSummarySchema = OidcProviderSchema.pick({ id: true, name: true });
export type ProviderSummary = z.infer<typeof ProviderSummarySchema>;

// ── Webhooks ───────────────────────────────────────────────────────

export const WebhookSchema = z.object({
  id: z.string(),
  name: z.string(),
  portainerInstanceId: z.string(),
  stackId: z.number(),
  enabled: z.boolean(),
  status: WebhookStatusSchema,
  instanceName: z.string().nullable(),
  deployTimeoutSeconds: z.number(),
  createdAt: timestamp,
  eventsTotal: z.number().optional(),
  eventsFailed: z.number().optional(),
});
export type Webhook = z.infer<typeof WebhookSchema>;

/**
 * Webhook as returned by the detail API.
 *
 * `token` is intentionally exposed here — the deploy URL the user copies
 * embeds it. It must never appear in list responses (WebhookSchema).
 */
export const WebhookDetailSchema = WebhookSchema.extend({
  token: z.string(),
  endpointId: z.number(),
  debounceSeconds: z.number(),
});
export type WebhookDetail = z.infer<typeof WebhookDetailSchema>;

/**
 * Minimal webhook returned after creation.
 * `token` is intentional — the caller needs the deploy URL.
 */
export const CreatedWebhookSchema = z.object({
  id: z.string(),
  name: z.string(),
  token: z.string(),
  portainerInstanceId: z.string(),
});
export type CreatedWebhook = z.infer<typeof CreatedWebhookSchema>;

// ── Events ─────────────────────────────────────────────────────────

/**
 * Evidence baseline recorded just before the redeploy PUT (on the
 * `deploying` step row). Recovery compares the live stack against this —
 * Docker-vs-Docker, Portainer-vs-Portainer — never against our own clock.
 */
export const DeploySnapshotSchema = z.object({
  at: z.number(),
  updateDate: z.number(),
  containers: z.array(
    z.object({ id: z.string(), created: z.number(), imageId: z.string() }),
  ),
});
export type DeploySnapshot = z.infer<typeof DeploySnapshotSchema>;

/** Outcome payload on terminal step rows (success|error). */
export const StepMessageSchema = z.object({ message: z.string().nullable() });
export type StepMessage = z.infer<typeof StepMessageSchema>;

/** Per-step payload: the pre-PUT snapshot on `deploying`, the outcome message on terminal rows. */
export const EventStepDataSchema = z
  .union([DeploySnapshotSchema, StepMessageSchema])
  .nullable();
export type EventStepData = z.infer<typeof EventStepDataSchema>;

/**
 * One row of the append-only deploy state machine log:
 * claimed → fetching → deploying → verifying → success|error.
 */
export const EventStepSchema = z.object({
  step: z.enum(EVENT_STEPS),
  createdAt: timestamp,
  data: EventStepDataSchema,
});
export type EventStep = z.infer<typeof EventStepSchema>;

export const EventSchema = z.object({
  id: z.string(),
  status: z.enum(EVENT_STATES),
  type: z.string(),
  triggerSource: z.string(),
  createdAt: timestamp,
  /** Full state-machine history, append-only (see webhook_event_steps). */
  steps: z.array(EventStepSchema),
  webhookName: z.string().optional(),
  instanceName: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;

// ── Portainer ──────────────────────────────────────────────────────

/**
 * The deployment journal carried on Portainer's stack object
 * (`DeploymentStatus`) — the status progression of the current
 * deployment, cleared when a new deployment starts. Field names are
 * Portainer's own (PascalCase); shared by the Portainer client and the
 * deploy state machine's evidence ladder.
 */
export const DeploymentJournalEntrySchema = z.object({
  Status: z.number(),
  Time: z.number(),
  Message: z.string().optional(),
});
export type DeploymentJournalEntry = z.infer<typeof DeploymentJournalEntrySchema>;

export const DeploymentJournalTypeSchema = z.array(DeploymentJournalEntrySchema);
export type DeploymentJournalType = z.infer<typeof DeploymentJournalTypeSchema>;

/**
 * A Portainer stack, as exposed by the instance sub-routes.
 *
 * Allowlisted down from Portainer's stack object — notably the stack's
 * `Env` (environment variable values, which can contain secrets) is
 * deliberately NOT exposed. The UI enriches these client-side with
 * `environmentName`.
 */
export const StackSchema = z.object({
  Id: z.number(),
  Name: z.string(),
  EndpointId: z.number(),
  Status: z.number(),
  Type: z.number(),
});
export type Stack = z.infer<typeof StackSchema> & { environmentName?: string };

/** An environment (endpoint) of a Portainer instance. */
export const EnvironmentSchema = z.object({
  Id: z.number(),
  Name: z.string(),
  Type: z.number(),
  URL: z.string(),
  Status: z.number(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;
