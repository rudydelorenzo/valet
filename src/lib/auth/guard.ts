import { getSession } from "@/lib/auth/session";

/**
 * Require an authenticated session. Returns the userId or throws.
 * Use in API routes: `const userId = await requireAuth();`
 */
export const requireAuth = async (): Promise<string> => {
  const session = await getSession();
  if (!session) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return session.sub; // userId
};

/**
 * Require an admin session. Returns the userId or throws.
 */
export const requireAdmin = async (): Promise<string> => {
  const session = await getSession();
  if (!session) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!session.isAdmin) {
    throw new Response(
      JSON.stringify({ error: "Admin access required" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  return session.sub;
};