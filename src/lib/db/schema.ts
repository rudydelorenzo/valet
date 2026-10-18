import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { id } from "../ids";

export const portainerInstances = sqliteTable("portainer_instances", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => id("inst")),
  name: text("name").notNull(),
  url: text("url").notNull(),
  token: text("token").notNull(),
  insecureTls: integer("insecure_tls", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhooks = sqliteTable("webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => id("whk")),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  portainerInstanceId: text("portainer_instance_id")
    .notNull()
    .references(() => portainerInstances.id, { onDelete: "cascade" }),
  stackId: integer("stack_id").notNull(),
  endpointId: integer("endpoint_id").notNull(),
  stackName: text("stack_name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  debounceSeconds: integer("debounce_seconds").notNull().default(5),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => id("evt")),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'success' | 'error' | 'pending'
  message: text("message"),
  triggerSource: text("trigger_source").notNull(), // 'webhook' | 'manual'
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const oidcProviders = sqliteTable("oidc_providers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => id("prov")),
  name: text("name").notNull(), // display name, e.g. "Authentik"
  issuer: text("issuer").notNull(), // OIDC issuer URL
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  scopes: text("scopes").notNull().default("openid email profile"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});