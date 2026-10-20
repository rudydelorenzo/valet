/**
 * Shared API response types. These are what the frontend consumes —
 * derived from DB types but with computed/joined fields added.
 * Import from here instead of defining locally.
 */

// ── Instances ──────────────────────────────────────────────────────

export interface Instance {
  id: string;
  name: string;
  url: string;
  insecureTls: boolean;
  hasToken?: boolean;
  createdAt: string;
}

// ── Webhooks ───────────────────────────────────────────────────────

export type WebhookStatus = "active" | "disabled" | "degraded";

/** Webhook as returned by the list API. */
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

// ── Portainer types ────────────────────────────────────────────────

export interface Stack {
  Id: number;
  Name: string;
  EndpointId: number;
  Status: number;
  /** Enriched client-side from the environments hook. */
  environmentName?: string;
}

export interface Environment {
  Id: number;
  Name: string;
  Type: number;
  URL: string;
  Status: number;
}

// ── OIDC providers ─────────────────────────────────────────────────

export interface OidcProvider {
  id: string;
  name: string;
  issuer?: string;
  clientId?: string;
  scopes?: string;
  skipEmailVerification?: boolean;
  enabled?: boolean;
  createdAt?: string;
}