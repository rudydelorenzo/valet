import { PillBadge, type PillColor } from "@/components/ui/pill-badge";

const WEBHOOK_STATUS_CONFIG: Record<
  string,
  { label: string; color: PillColor }
> = {
  active: { label: "Active", color: "green" },
  disabled: { label: "Disabled", color: "gray" },
  degraded: { label: "Degraded", color: "amber" },
};

const WebhookStatusBadge = ({ status }: { status: string }) => {
  const config = WEBHOOK_STATUS_CONFIG[status] ?? {
    label: status,
    color: "gray" as PillColor,
  };

  return (
    <PillBadge color={config.color} dot>
      {config.label}
    </PillBadge>
  );
};

export { WebhookStatusBadge };