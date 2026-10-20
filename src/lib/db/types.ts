/**
 * Application types — the shapes this app passes between its API routes
 * and the frontend. These are JSON-serialized, secret-free views of the
 * row types in ./schema.ts: secrets are stripped by the toPublic*
 * projectors, and joined/computed fields are added by the API routes.
 *
 * Endpoint-specific API contract types (e.g. ReachabilityResult) live in
 * @/types/api. Portainer's own API shapes live in @/lib/portainer.
 */
import type { WebhookStatus } from "@/types/api";
import type { PortainerStack, PortainerEnvironment } from "@/lib/portainer";

// ── Users ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

// ── Instances ──────────────────────────────────────────────────────

/** A Portainer instance, as exposed over the API (never includes the token). */
export interface Instance {
  id: string;
  name: string;
  url: string;
  insecureTls: boolean;
  /** Whether an access token is stored for this instance. */
  hasToken: boolean;
  createdAt: string;
}

// ── OIDC providers ─────────────────────────────────────────────────

/** An OIDC provider, as exposed over the API (never includes the client secret). */
export interface OidcProvider {
  id: string;
  name: string;
  issuer: string;
  clientId: string;
  scopes: string;
  skipEmailVerification: boolean;
  enabled: boolean;
  createdAt: string;
}

/** Minimal provider shape exposed on the login page (never secrets). */
export type ProviderSummary = Pick<OidcProvider, "id" | "name">;

// ── Webhooks ───────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  name: string;
  portainerInstanceId: string;
  stackId: number;
  enabled: boolean;
  status: WebhookStatus;
  instanceName: string | null;
  createdAt: string;
  eventsTotal?: number;
  eventsFailed?: number;
}

/** Webhook as returned by the detail API (includes token and endpoint). */
export interface WebhookDetail extends Webhook {
  token: string;
  endpointId: number;
  debounceSeconds: number;
}

/** Minimal webhook returned after creation. */
export interface CreatedWebhook {
  id: string;
  name: string;
  token: string;
  portainerInstanceId: string;
}

// ── Events ─────────────────────────────────────────────────────────

export interface Event {
  id: string;
  status: string;
  type: string;
  message: string | null;
  triggerSource: string;
  createdAt: string;
  webhookName?: string;
  instanceName?: string;
}

// ── Portainer ──────────────────────────────────────────────────────

/** A stack, enriched client-side with the name of its environment. */
export type Stack = PortainerStack & { environmentName?: string };

/** An environment (endpoint) of a Portainer instance. */
export type Environment = PortainerEnvironment;
