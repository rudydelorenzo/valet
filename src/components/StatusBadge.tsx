import type React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader,
  Clock,
} from "lucide-react";

const statusConfig: Record<
  string,
  { icon: React.ElementType; className: string }
> = {
  success: {
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  error: {
    icon: XCircle,
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  running: {
    icon: Loader,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  queued: {
    icon: Clock,
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] ?? {
    icon: Clock,
    className: "bg-secondary text-secondary-foreground",
  };
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className={status === "running" ? "animate-spin" : undefined} />
      {status}
    </Badge>
  );
};

export { StatusBadge };