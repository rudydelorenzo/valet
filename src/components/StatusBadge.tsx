import type React from "react";
import { PillBadge, type PillColor } from "@/components/ui/pill-badge";
import {
  CheckCircle2,
  XCircle,
  Loader,
  Clock,
} from "lucide-react";

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: PillColor; spin?: boolean }
> = {
  success: { icon: CheckCircle2, color: "green" },
  error: { icon: XCircle, color: "red" },
  running: { icon: Loader, color: "blue", spin: true },
  queued: { icon: Clock, color: "amber" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] ?? {
    icon: Clock,
    color: "amber" as PillColor,
  };
  const Icon = config.icon;

  return (
    <PillBadge color={config.color}>
      <Icon className={config.spin ? "animate-spin" : undefined} />
      {status}
    </PillBadge>
  );
};

export { StatusBadge };