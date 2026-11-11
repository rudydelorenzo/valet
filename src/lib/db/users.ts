import { db } from "@/lib/db";
import { users, userOidcLinks, type User, type UserOidcLink } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────

/** Fetch a user by ID. */
export const getUser = async (id: User["id"]) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
};

/** Fetch a user by email address. */
export const getUserByEmail = async (email: User["email"]) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
};

/** List all users, newest first. */
export const listUsers = async () => {
  return db.select().from(users).orderBy(desc(users.createdAt));
};

// ── Write ─────────────────────────────────────────────────────────

/** Create a new user. */
export const createUser = async (data: {
  email: User["email"];
  name: User["name"];
  isAdmin?: User["isAdmin"];
}) => {
  const [user] = await db
    .insert(users)
    .values(data)
    .returning();
  return user;
};

/** Patch a user (currently just the admin flag). */
export const updateUser = async (
  id: User["id"],
  updates: { isAdmin: User["isAdmin"] },
): Promise<User | null> => {
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
};

// ── OIDC identity links ───────────────────────────────────────────

/** Fetch a user↔provider link by (provider, subject). */
export const getUserOidcLink = async (
  providerId: UserOidcLink["providerId"],
  oidcSub: UserOidcLink["oidcSub"],
): Promise<UserOidcLink | null> => {
  const [link] = await db
    .select()
    .from(userOidcLinks)
    .where(
      and(
        eq(userOidcLinks.providerId, providerId),
        eq(userOidcLinks.oidcSub, oidcSub),
      ),
    )
    .limit(1);
  return link ?? null;
};

/** Link a user to an OIDC identity. */
export const insertUserOidcLink = async (
  userId: User["id"],
  providerId: UserOidcLink["providerId"],
  oidcSub: UserOidcLink["oidcSub"],
): Promise<void> => {
  await db.insert(userOidcLinks).values({ userId, providerId, oidcSub });
};
