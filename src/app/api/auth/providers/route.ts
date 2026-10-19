import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET — list enabled providers (public, used by the login page).
 * Only exposes name and id — never secrets.
 */
export const GET = async () => {
  const providers = await db
    .select({
      id: oidcProviders.id,
      name: oidcProviders.name,
    })
    .from(oidcProviders)
    .where(eq(oidcProviders.enabled, true));

  return Response.json(providers);
};