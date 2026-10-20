import { PillBadge } from "@/components/ui/pill-badge";

interface ReachabilityResult {
  reachable: boolean;
  version?: string;
}

/**
 * Badge showing instance reachability. Shows a loading state until
 * the first result arrives, then green/red based on the poll result.
 */
const ReachabilityBadge = ({ status }: { status?: ReachabilityResult }) => {
  // First poll hasn't returned yet
  if (!status) {
    return (
      <PillBadge color="gray" dot>
        Checking…
      </PillBadge>
    );
  }

  return (
    <PillBadge color={status.reachable ? "green" : "red"} dot>
      {status.reachable
        ? `Connected${status.version ? ` · v${status.version}` : ""}`
        : "Disconnected"}
    </PillBadge>
  );
};

export { ReachabilityBadge };