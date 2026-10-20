import { db } from "@/lib/db";
import { portainerInstances, type PortainerInstance } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { Instance } from "./types";

// ── Public shape ───────────────────────────────────────────────────

/**
 * Whitelist projection that strips the access token and serializes the
 * instance into its application shape (see ./types) before it is returned
 * over the API. Compile-checked: when the schema gains a column, this
 * must be updated or the build fails.
 */
export const toPublicInstance = (instance: PortainerInstance): Instance => ({
  id: instance.id,
  name: instance.name,
  url: instance.url,
  insecureTls: instance.insecureTls,
  hasToken: Boolean(instance.token),
  createdAt: instance.createdAt.toISOString(),
});

// ── Read ──────────────────────────────────────────────────────────

/**
 * Fetch an instance by ID (full row, including the token — needed to
 * call the Portainer API). Pass through `toPublicInstance` before
 * returning one over the API.
 */
export const getPortainerInstance = async (id: string) => {
  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .limit(1);
  return instance ?? null;
};

/**
 * List a user's instances, newest first. When `ids` is given, only
 * those instances are returned.
 */
export const listPortainerInstancesByUser = async (
  userId: string,
  ids?: string[],
) => {
  return db
    .select()
    .from(portainerInstances)
    .where(
      ids
        ? and(
            eq(portainerInstances.userId, userId),
            inArray(portainerInstances.id, ids),
          )
        : eq(portainerInstances.userId, userId),
    )
    .orderBy(desc(portainerInstances.createdAt));
};

// ── Write ─────────────────────────────────────────────────────────

/** Create a new Portainer instance. */
export const createPortainerInstance = async (data: {
  userId: string;
  name: string;
  url: string;
  token: string;
  insecureTls?: boolean;
}) => {
  const [instance] = await db
    .insert(portainerInstances)
    .values(data)
    .returning();
  return instance;
};

/** Patch an instance (name, url, token, insecureTls). */
export const updatePortainerInstance = async (
  id: string,
  updates: {
    name?: string;
    url?: string;
    token?: string;
    insecureTls?: boolean;
  },
): Promise<PortainerInstance | null> => {
  const [updated] = await db
    .update(portainerInstances)
    .set(updates)
    .where(eq(portainerInstances.id, id))
    .returning();
  return updated ?? null;
};

/** Delete an instance by ID (cascades to its webhooks). */
export const deletePortainerInstance = async (id: string) => {
  const [deleted] = await db
    .delete(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .returning();
  return deleted ?? null;
};
