import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ authenticated: false });
  }
  return Response.json({
    authenticated: true,
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name,
    },
  });
}