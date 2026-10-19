import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Fetch a Portainer instance by ID. */
export const getPortainerInstance = async (id: string) => {
  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .limit(1);
  return instance ?? null;
};