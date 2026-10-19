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

// ── Required OIDC scopes ───────────────────────────────────────────
export const REQUIRED_OIDC_SCOPES = ["openid", "email"];

// ── Webhook event status / source ──────────────────────────────────
export const EVENT_STATUS_PENDING = "pending";
export const EVENT_STATUS_SUCCESS = "success";
export const EVENT_STATUS_ERROR = "error";
export const EVENT_SOURCE_WEBHOOK = "webhook";
export const EVENT_SOURCE_MANUAL = "manual";