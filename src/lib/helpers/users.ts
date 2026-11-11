import {
  getUser,
  getUserByEmail,
  createUser,
  getUserOidcLink,
  insertUserOidcLink,
  listUsers,
} from "@/lib/db/users";
import type { User, UserOidcLink, OidcProvider } from "@/lib/db/schema";

/** Count users with the admin flag (last-admin guard). */
export const countAdmins = async (): Promise<number> =>
  (await listUsers()).filter((u) => u.isAdmin).length;

/** Whether any user exists (first-user-gets-admin check). */
const hasAnyUser = async (): Promise<boolean> => (await listUsers()).length > 0;

/**
 * Look up or create a user from OIDC userinfo.
 * 1. Match by (providerId, oidcSub) → existing link → return user
 * 2. Match by email → existing user → create link → return user
 * 3. No match → create user + link → return user
 */
export const findOrCreateUser = async (params: {
  email: User["email"];
  name: User["name"];
  oidcSub: UserOidcLink["oidcSub"];
  providerId: OidcProvider["id"];
}): Promise<{ user: User; isNew: boolean }> => {
  const { email, name, oidcSub, providerId } = params;

  // 1. Direct link match
  const existingLink = await getUserOidcLink(providerId, oidcSub);
  if (existingLink) {
    const user = await getUser(existingLink.userId);
    return { user: user!, isNew: false };
  }

  // 2. Email match — link to existing user
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    await insertUserOidcLink(existingUser.id, providerId, oidcSub);
    return { user: existingUser, isNew: false };
  }

  // 3. Brand new user — the first user gets admin
  const newUser = await createUser({
    email,
    name,
    isAdmin: !(await hasAnyUser()),
  });
  await insertUserOidcLink(newUser.id, providerId, oidcSub);
  return { user: newUser, isNew: true };
};
