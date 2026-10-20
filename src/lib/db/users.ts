import { db } from "@/lib/db";
import { users, userOidcLinks, type User } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────

/** Fetch a user by ID. */
export const getUser = async (id: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
};

/** Fetch a user by email address. */
export const getUserByEmail = async (email: string) => {
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

/** Count users with the admin flag (last-admin guard). */
export const countAdmins = async (): Promise<number> => {
  return db.$count(users, eq(users.isAdmin, true));
};

// ── Write ─────────────────────────────────────────────────────────

/** Create a new user. */
export const createUser = async (data: {
  email: string;
  name: string;
  isAdmin?: boolean;
}) => {
  const [user] = await db
    .insert(users)
    .values(data)
    .returning();
  return user;
};

/** Patch a user (currently just the admin flag). */
export const updateUser = async (
  id: string,
  updates: { isAdmin: boolean },
): Promise<User | null> => {
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
};

// ── OIDC identity links ───────────────────────────────────────────

/**
 * Look up or create a user from OIDC userinfo.
 * 1. Match by (providerId, oidcSub) → existing link → return user
 * 2. Match by email → existing user → create link → return user
 * 3. No match → create user + link → return user
 */
export const findOrCreateUser = async (params: {
  email: string;
  name: string;
  oidcSub: string;
  providerId: string;
}): Promise<{ user: User; isNew: boolean }> => {
  const { email, name, oidcSub, providerId } = params;

  // 1. Direct link match
  const [existingLink] = await db
    .select({ userId: userOidcLinks.userId })
    .from(userOidcLinks)
    .where(
      and(
        eq(userOidcLinks.providerId, providerId),
        eq(userOidcLinks.oidcSub, oidcSub),
      ),
    )
    .limit(1);

  if (existingLink) {
    const user = await getUser(existingLink.userId);
    return { user: user!, isNew: false };
  }

  // 2. Email match — link to existing user
  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    await db.insert(userOidcLinks).values({
      userId: existingUser.id,
      providerId,
      oidcSub,
    });
    return { user: existingUser, isNew: false };
  }

  // 3. Brand new user — the first user gets admin
  const isFirstUser = (await db.select({ id: users.id }).from(users).limit(1)).length === 0;

  const newUser = await createUser({
    email,
    name,
    isAdmin: isFirstUser,
  });

  await db.insert(userOidcLinks).values({
    userId: newUser.id,
    providerId,
    oidcSub,
  });

  return { user: newUser, isNew: true };
};
