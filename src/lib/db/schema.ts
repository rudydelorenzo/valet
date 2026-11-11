import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";
import { id } from "../ids";
import {
  DEFAULT_DEBOUNCE_SECONDS,
  DEFAULT_OIDC_SCOPES,
  DEFAULT_DEPLOY_TIMEOUT_SECONDS,
  type EventStepName,
} from "@/lib/constants";

// ── Table → prefix map ─────────────────────────────────────────────
const TABLE_PREFIXES = {
  users: "usr",
  user_oidc_links: "link",
  portainer_instances: "inst",
  webhooks: "whk",
  webhook_events: "evt",
  webhook_event_steps: "stp",
  oidc_providers: "prov",
} as const;

type TableName = keyof typeof TABLE_PREFIXES;

/** Generates a `$defaultFn` that produces a prefixed ID for a given table. */
const prefixedId = (table: TableName) => () => id(TABLE_PREFIXES[table]);

// ── Users ──────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(prefixedId("users")),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userOidcLinks = sqliteTable("user_oidc_links", {
  id: text("id").primaryKey().$defaultFn(prefixedId("user_oidc_links")),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id")
    .notNull()
    .references(() => oidcProviders.id, { onDelete: "cascade" }),
  oidcSub: text("oidc_sub").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => [
  unique().on(t.providerId, t.oidcSub),
  unique().on(t.providerId, t.userId),
]);

// ── OIDC providers ─────────────────────────────────────────────────

export const oidcProviders = sqliteTable("oidc_providers", {
  id: text("id").primaryKey().$defaultFn(prefixedId("oidc_providers")),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  scopes: text("scopes").notNull().default(DEFAULT_OIDC_SCOPES),
  skipEmailVerification: integer("skip_email_verification", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Portainer instances ────────────────────────────────────────────

export const portainerInstances = sqliteTable("portainer_instances", {
  id: text("id").primaryKey().$defaultFn(prefixedId("portainer_instances")),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  token: text("token").notNull(),
  insecureTls: integer("insecure_tls", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Webhooks ───────────────────────────────────────────────────────

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey().$defaultFn(prefixedId("webhooks")),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  portainerInstanceId: text("portainer_instance_id")
    .notNull()
    .references(() => portainerInstances.id, { onDelete: "cascade" }),
  stackId: integer("stack_id").notNull(),
  endpointId: integer("endpoint_id").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  debounceSeconds: integer("debounce_seconds").notNull().default(DEFAULT_DEBOUNCE_SECONDS),
  /** How long after the webhook call a deploy may run before it's marked failed. */
  deployTimeoutSeconds: integer("deploy_timeout_seconds")
    .notNull()
    .default(DEFAULT_DEPLOY_TIMEOUT_SECONDS),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Webhook events ─────────────────────────────────────────────────

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey().$defaultFn(prefixedId("webhook_events")),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  triggerSource: text("trigger_source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Event step log ─────────────────────────────────────────────────

/**
 * Append-only log of the deploy state machine — the ONLY place state
 * lives (the event row is identity + trigger; lifecycle status is
 * derived from the log):
 * created → queued → claimed → fetching → deploying → verifying →
 * success|error, where `queued` is the pickable marker (written at birth
 * and re-appended on recovery re-enqueue).
 *
 * One row per transition — the full history of an event is reconstructable
 * from this table alone. Terminal rows (success|error) carry the outcome
 * message in `data`; the `deploying` row carries the pre-PUT evidence
 * snapshot. Nothing is ever updated here, only inserted.
 */
export const webhookEventSteps = sqliteTable(
  "webhook_event_steps",
  {
    id: text("id").primaryKey().$defaultFn(prefixedId("webhook_event_steps")),
    eventId: text("event_id")
      .notNull()
      .references(() => webhookEvents.id, { onDelete: "cascade" }),
    step: text("step").$type<EventStepName>().notNull(),
    /** JSON payload: the pre-PUT snapshot on `deploying`, { message } on terminal rows. */
    data: text("data"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("webhook_event_steps_event_idx").on(t.eventId, t.createdAt)],
);

// ── Inferred types ────────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type UserOidcLink = InferSelectModel<typeof userOidcLinks>;
export type PortainerInstance = InferSelectModel<typeof portainerInstances>;
export type Webhook = InferSelectModel<typeof webhooks>;
export type WebhookEvent = InferSelectModel<typeof webhookEvents>;
export type WebhookEventStep = InferSelectModel<typeof webhookEventSteps>;
export type OidcProvider = InferSelectModel<typeof oidcProviders>;