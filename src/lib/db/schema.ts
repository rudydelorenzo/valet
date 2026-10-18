import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { id } from "../ids";
import { DEFAULT_DEBOUNCE_SECONDS, DEFAULT_OIDC_SCOPES } from "@/lib/constants";

// ── Table → prefix map ─────────────────────────────────────────────
const TABLE_PREFIXES = {
  portainer_instances: "inst",
  webhooks: "whk",
  webhook_events: "evt",
  oidc_providers: "prov",
} as const;

type TableName = keyof typeof TABLE_PREFIXES;

/** Generates a `$defaultFn` that produces a prefixed ID for a given table. */
const prefixedId = (table: TableName) => () => id(TABLE_PREFIXES[table]);

// ── Tables ─────────────────────────────────────────────────────────

export const portainerInstances = sqliteTable("portainer_instances", {
  id: text("id").primaryKey().$defaultFn(prefixedId("portainer_instances")),
  name: text("name").notNull(),
  url: text("url").notNull(),
  token: text("token").notNull(),
  insecureTls: integer("insecure_tls", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey().$defaultFn(prefixedId("webhooks")),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  portainerInstanceId: text("portainer_instance_id")
    .notNull()
    .references(() => portainerInstances.id, { onDelete: "cascade" }),
  stackId: integer("stack_id").notNull(),
  endpointId: integer("endpoint_id").notNull(),
  stackName: text("stack_name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  debounceSeconds: integer("debounce_seconds").notNull().default(DEFAULT_DEBOUNCE_SECONDS),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey().$defaultFn(prefixedId("webhook_events")),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  message: text("message"),
  triggerSource: text("trigger_source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const oidcProviders = sqliteTable("oidc_providers", {
  id: text("id").primaryKey().$defaultFn(prefixedId("oidc_providers")),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  scopes: text("scopes").notNull().default(DEFAULT_OIDC_SCOPES),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});