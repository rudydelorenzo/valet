import { db } from "@/lib/db";
import { users, userOidcLinks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { id } from "@/lib/ids";

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
}): Promise<{ user: typeof users.$inferSelect; isNew: boolean }> => {
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
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingLink.userId))
      .limit(1);
    return { user, isNew: false };
  }

  // 2. Email match — link to existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    await db.insert(userOidcLinks).values({
      id: id("link"),
      userId: existingUser.id,
      providerId,
      oidcSub,
    });
    return { user: existingUser, isNew: false };
  }

  // 3. Brand new user
  const isfirstUser = (await db.select().from(users).limit(1)).length === 0;

  const [newUser] = await db
    .insert(users)
    .values({
      id: id("usr"),
      email,
      name,
      isAdmin: isfirstUser, // first user gets admin
    })
    .returning();

  await db.insert(userOidcLinks).values({
    id: id("link"),
    userId: newUser.id,
    providerId,
    oidcSub,
  });

  return { user: newUser, isNew: true };
};