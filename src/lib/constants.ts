// ── Cookie names ────────────────────────────────────────────────────
export const SESSION_COOKIE = "valet.session";
export const SETUP_COOKIE = "valet.setup";
export const PKCE_COOKIE = "valet.pkce";

// ── JWT / crypto ───────────────────────────────────────────────────
export const JWT_ISSUER = "valet";
export const JWT_ALGORITHM = "HS256" as const;
export const DEV_SECRET_FALLBACK = "valet-dev-secret-do-not-use-in-prod";

// ── Time durations (seconds) ───────────────────────────────────────
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SETUP_COOKIE_MAX_AGE_SECONDS = 3600; // 1 hour
export const PKCE_COOKIE_MAX_AGE_SECONDS = 300; // 5 minutes

// ── Setup code ─────────────────────────────────────────────────────
export const SETUP_CODE_LENGTH = 6;

// ── Defaults ───────────────────────────────────────────────────────
export const DEFAULT_DEBOUNCE_SECONDS = 5;
export const DEFAULT_OIDC_SCOPES = "openid email profile";
export const DEFAULT_DB_PATH = "./data/valet.db";
export const CALLBACK_PATH = "/api/auth/callback";

// ── Deploy state machine ───────────────────────────────────────────

/** How long after the webhook call a deploy may run before it's marked failed. */
export const DEFAULT_DEPLOY_TIMEOUT_SECONDS = 300;
export const MIN_DEPLOY_TIMEOUT_SECONDS = 10;
export const MAX_DEPLOY_TIMEOUT_SECONDS = 86400;

/** Poll interval while watching a stack reach the deployed state. */
export const DEPLOY_WATCH_INTERVAL_MS = 5_000;

// ── Portainer stack statuses (portainer.StackStatus) ───────────────
export const STACK_STATUS = {
  /** 1 — deployed and running */
  ACTIVE: 1,
  /** 2 — intentionally stopped. Deploys are refused: they would activate it. */
  INACTIVE: 2,
  /** 3 — deployment in progress */
  DEPLOYING: 3,
  /** 4 — deployment failed */
  ERROR: 4,
} as const;

// ── Required OIDC scopes ───────────────────────────────────────────
export const REQUIRED_OIDC_SCOPES = ["openid", "email", "profile"];

// ── Webhook events ─────────────────────────────────────────────────

/**
 * In-flight lifecycle states — the event is committed to run (queued) or
 * being worked on (running). "In-flight" rather than "processing": queued
 * work is not being processed yet, but it is already on its way.
 */
export const INFLIGHT_STATE = {
  QUEUED: "queued",
  RUNNING: "running",
} as const;
export type InflightState = (typeof INFLIGHT_STATE)[keyof typeof INFLIGHT_STATE];

/** Terminal outcomes — where an event's lifecycle ends. */
export const TERMINAL_STATE = {
  SUCCESS: "success",
  ERROR: "error",
} as const;
export type TerminalState = (typeof TERMINAL_STATE)[keyof typeof TERMINAL_STATE];

/** The derived lifecycle status (what the wire exposes): in-flight | terminal. */
export const EVENT_STATES = { ...INFLIGHT_STATE, ...TERMINAL_STATE } as const;
export type EventState = InflightState | TerminalState;

/**
 * Deploy state-machine positions — the non-terminal values the
 * webhook_event_steps.step column accepts (terminal rows carry the
 * outcome values from TERMINAL_STATE).
 */
export const DEPLOY_STEP = {
  CREATED: "created",
  QUEUED: "queued",
  CLAIMED: "claimed",
  FETCHING: "fetching",
  DEPLOYING: "deploying",
  VERIFYING: "verifying",
} as const;
export type DeployStepName = (typeof DEPLOY_STEP)[keyof typeof DEPLOY_STEP];

/** Everything the webhook_event_steps.step column accepts: positions | terminal. */
export const EVENT_STEPS = { ...DEPLOY_STEP, ...TERMINAL_STATE } as const;
export type EventStepName = DeployStepName | TerminalState;

export const EVENT_TYPE = {
  DEPLOY: "deploy",
} as const;

export const EVENT_SOURCE = {
  WEBHOOK: "webhook",
  MANUAL: "manual",
} as const;

// ── Webhook health ─────────────────────────────────────────────────

/** Degradation window in milliseconds (24 hours). */
export const DEGRADATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** A webhook is degraded when more than this fraction of events failed. */
export const DEGRADATION_THRESHOLD = 0.3;

/** Derived state of a webhook, computed from enabled + 24h failure rate. */
export const WEBHOOK_STATUS = {
  ACTIVE: "active",
  DISABLED: "disabled",
  DEGRADED: "degraded",
} as const;

// The union type lives with the other API types; re-exported here so it
// stays next to its values. Values above must match the union.
export type { WebhookStatus } from "@/types/api";