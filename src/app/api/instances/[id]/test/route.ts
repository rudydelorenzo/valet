import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { testConnection } from "@/lib/portainer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .limit(1);

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await testConnection(
    instance.url,
    instance.token,
    instance.insecureTls,
  );

  return Response.json(result);
}