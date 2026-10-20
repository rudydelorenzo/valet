import { cn } from "@/lib/utils";

const colorMap = {
  green:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 [&>span]:bg-emerald-500",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 [&>span]:bg-red-400",
  blue:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400 [&>span]:bg-blue-500",
  amber:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>span]:bg-amber-500",
  gray:
    "bg-muted text-muted-foreground [&>span]:bg-muted-foreground/50",
} as const;

type PillColor = keyof typeof colorMap;

const PillBadge = ({
  color,
  dot = false,
  className,
  children,
}: {
  color: PillColor;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
      "[&>svg]:pointer-events-none [&>svg]:size-3!",
      colorMap[color],
      className,
    )}
  >
    {dot && <span className="size-1.5 rounded-full" />}
    {children}
  </span>
);

export { PillBadge, colorMap };
export type { PillColor };