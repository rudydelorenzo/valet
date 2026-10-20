/**
 * API-surface types — narrow contracts for specific endpoints.
 *
 * Broad application models (the shapes shared across the whole app)
 * live in @/lib/db/types.
 */

/** Standard error body returned by API routes. */
export interface ApiError {
  error: string;
}

/**
 * Result of pinging a Portainer instance's /api/status.
 * GET /api/instances/reachability → { results: Record<id, ReachabilityResult> }.
 */
export interface ReachabilityResult {
  reachable: boolean;
  version?: string;
}

/** Health status of a webhook, from its enabled flag and 24h failure rate. */
export type WebhookStatus = "active" | "disabled" | "degraded";
