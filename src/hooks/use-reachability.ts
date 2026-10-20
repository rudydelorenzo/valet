"use client";

import { useEffect, useState, useRef } from "react";

interface ReachabilityResult {
  reachable: boolean;
  version?: string;
}

const POLL_INTERVAL = 5000;

/**
 * Polls /api/instances/reachability for one or more instance IDs.
 * Returns a map of instance ID → { reachable, version? }.
 */
export function useReachability(instanceIds: string[]) {
  const [results, setResults] = useState<Record<string, ReachabilityResult>>(
    {},
  );
  const idsRef = useRef(instanceIds);

  // Keep ref in sync
  useEffect(() => {
    idsRef.current = instanceIds;
  }, [instanceIds]);

  useEffect(() => {
    if (instanceIds.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const ids = idsRef.current.join(",");
        const res = await fetch(
          `/api/instances/reachability?ids=${encodeURIComponent(ids)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.results) {
          setResults((prev) => ({ ...prev, ...data.results }));
        }
      } catch {
        // ignore network errors during polling
      }
    };

    // Immediate first poll
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [instanceIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return results;
}