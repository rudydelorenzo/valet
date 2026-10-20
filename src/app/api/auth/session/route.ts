import { getSession } from "@/lib/auth/session";
import { json } from "@/lib/http";
import { SessionStatusSchema, type SessionStatus } from "@/types/api";
import type { NextResponse } from "next/server";

export const GET = async (): Promise<NextResponse<SessionStatus>> => {
  const session = await getSession();
  if (!session) {
    return json(SessionStatusSchema, { authenticated: false });
  }
  return json(SessionStatusSchema, {
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      isAdmin: session.isAdmin,
    },
  });
};
