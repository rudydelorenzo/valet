import Link from "next/link";
import { Button } from "@/components/ui/button";

const ADMIN_LINKS = [
  { href: "/admin/settings", label: "Identity providers" },
  { href: "/admin/users", label: "Users" },
];

const AdminLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8">
      <aside className="w-48 shrink-0">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </h2>
        <nav className="flex flex-col gap-0.5">
          {ADMIN_LINKS.map(({ href, label }) => (
            <Button key={href} variant="ghost" size="sm" className="justify-start" nativeButton={false} render={<Link href={href} />}>
              {label}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
};

export default AdminLayout;