import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/instances/[id]/favicon
 *
 * Looks up the instance URL from the DB, finds its favicon, and proxies
 * the image bytes back. Returns the image directly (with content-type)
 * so the client can use it as <img src="...">.
 *
 * Returns 204 if no favicon could be fetched.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [instance] = await db
    .select({ url: portainerInstances.url })
    .from(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .limit(1);

  if (!instance) {
    return new NextResponse(null, { status: 404 });
  }

  let origin: string;
  try {
    origin = new URL(instance.url).origin;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Collect candidate favicon URLs to try
  const candidates: string[] = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(origin, {
      signal: controller.signal,
      headers: { "User-Agent": "valet/1.0" },
    });

    if (res.ok) {
      const html = await res.text();

      const linkRegex =
        /<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i;
      const linkRegexAlt =
        /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*\/?>/i;

      const match = linkRegex.exec(html) ?? linkRegexAlt.exec(html);
      if (match) {
        candidates.push(new URL(match[1], origin).href);
      }
    }
  } catch {
    // HTML fetch failed — try favicon.ico directly
  } finally {
    clearTimeout(timeout);
  }

  candidates.push(`${origin}/favicon.ico`);

  // Try each candidate until one returns a valid image
  for (const url of candidates) {
    try {
      const imgRes = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "valet/1.0" },
      });

      if (!imgRes.ok) continue;

      const contentType = imgRes.headers.get("content-type") ?? "";
      // Make sure it's actually an image, not an HTML error page
      if (!contentType.startsWith("image/")) continue;

      const body = await imgRes.arrayBuffer();
      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      // Try next candidate
    }
  }

  return new NextResponse(null, { status: 204 });
}