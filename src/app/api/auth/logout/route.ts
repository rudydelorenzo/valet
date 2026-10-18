import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("valet.session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
};