import { db } from "@/lib/db";
import { portainerInstances, type PortainerInstance, type User } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────

/**
 * Fetch an instance by ID (full row, including the token — needed to
 * call the Portainer API). Pass through `toPublicInstance` (lib/helpers)
 * before returning one over the API.
 */
export const getPortainerInstance = async (id: PortainerInstance["id"]) => {
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
  userId: User["id"],
  ids?: PortainerInstance["id"][],
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
  userId: User["id"];
  name: PortainerInstance["name"];
  url: PortainerInstance["url"];
  token: PortainerInstance["token"];
  insecureTls?: PortainerInstance["insecureTls"];
}) => {
  const [instance] = await db
    .insert(portainerInstances)
    .values(data)
    .returning();
  return instance;
};

/** Patch an instance (name, url, token, insecureTls). */
export const updatePortainerInstance = async (
  id: PortainerInstance["id"],
  updates: {
    name?: PortainerInstance["name"];
    url?: PortainerInstance["url"];
    token?: PortainerInstance["token"];
    insecureTls?: PortainerInstance["insecureTls"];
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
export const deletePortainerInstance = async (id: PortainerInstance["id"]) => {
  const [deleted] = await db
    .delete(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .returning();
  return deleted ?? null;
};
