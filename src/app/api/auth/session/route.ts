import { getSession } from "@/lib/auth/session";

export const GET = async () => {
  const session = await getSession();
  if (!session) {
    return Response.json({ authenticated: false });
  }
  return Response.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      isAdmin: session.isAdmin,
    },
  });
};