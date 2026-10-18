"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Session {
  authenticated: boolean;
  user?: { name: string; email: string };
}

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/instances", label: "Instances" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/admin/settings", label: "Admin" },
];

const Nav = () => {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false }));
  }, []);

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-5 px-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Valet
        </Link>

        <div className="flex items-center gap-0.5">
          {LINKS.map(({ href, label }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Button
                key={href}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                nativeButton={false}
                render={<Link href={href} />}
              >
                {label}
              </Button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {session?.authenticated && (
            <>
              <span className="hidden text-xs sm:inline">
                {session.user?.name}
              </span>
              <Button variant="ghost" size="sm" nativeButton={false} render={<a href="/api/auth/logout" />}>
                Log out
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Nav;