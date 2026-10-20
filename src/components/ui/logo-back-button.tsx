"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * A generic logo-as-back-button. Pass the logo as the first child.
 * On hover, the block gains a muted background, a chevron slides in
 * from the left, and the logo nudges right.
 */
const LogoBackButton = ({
  href,
  title = "Back",
  logo,
  children,
}: {
  href: string;
  title?: string;
  /** The logo element to display. Sized by the component. */
  logo: React.ReactNode;
  children?: React.ReactNode;
}) => {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2 rounded-lg py-1 pl-1 pr-3 transition-all hover:bg-muted hover:pl-6"
      title={title}
    >
      <ChevronLeft className="absolute left-1 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {logo}
      </div>
      {children}
    </Link>
  );
};

export { LogoBackButton };