import { Badge } from "@/components/ui/badge";

const StatusBadge = ({ status }: { status: string }) => {
  const variant =
    status === "success"
      ? "default"
      : status === "error"
        ? "destructive"
        : status === "running"
          ? "default"
          : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
};

export { StatusBadge };