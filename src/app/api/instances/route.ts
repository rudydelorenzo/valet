import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { testConnection } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";

export const GET = async () => {
  const userId = await requireAuth();

  const instances = await db
    .select({
      id: portainerInstances.id,
      name: portainerInstances.name,
      url: portainerInstances.url,
      insecureTls: portainerInstances.insecureTls,
      createdAt: portainerInstances.createdAt,
    })
    .from(portainerInstances)
    .where(eq(portainerInstances.userId, userId))
    .orderBy(desc(portainerInstances.createdAt));

  return Response.json(instances);
};

export const POST = async (request: Request) => {
  const userId = await requireAuth();

  const body = await request.json();
  const { name, url, token, insecureTls } = body as {
    name?: string;
    url?: string;
    token?: string;
    insecureTls?: boolean;
  };

  if (!name || !url || !token) {
    return Response.json(
      { error: "name, url, and token are required" },
      { status: 400 },
    );
  }

  // Test the connection before saving
  const result = await testConnection(url, token, insecureTls ?? false);
  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  const [instance] = await db
    .insert(portainerInstances)
    .values({
      userId,
      name,
      url,
      token,
      insecureTls: insecureTls ?? false,
    })
    .returning();

  return Response.json(instance, { status: 201 });
};