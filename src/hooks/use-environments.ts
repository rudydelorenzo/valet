"use client";

import { useEffect, useState, useCallback } from "react";
import type { Environment } from "@/types";

/**
 * Fetches and manages Portainer environments for an instance.
 * Returns the list, loading state, and a refresh function.
 */
export function useEnvironments(instanceId: string | undefined) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(Boolean(instanceId));
  const [prevId, setPrevId] = useState(instanceId);

  // A new instance id starts a new load — adjust state during render
  // (React's sanctioned pattern for state derived from a prop change).
  if (instanceId !== prevId) {
    setPrevId(instanceId);
    setLoading(instanceId !== undefined);
  }

  // Fetch; state updates happen in promise callbacks, so this is safe
  // to call from an effect as well as from event handlers.
  const load = useCallback(() => {
    if (!instanceId) return;
    fetch(`/api/instances/${instanceId}/environments`)
      .then((res) => res.json())
      .then((data) => {
        setEnvironments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // keep existing environments on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, [instanceId]);

  // Manual refresh — sets loading immediately (fine: called from handlers)
  const refresh = useCallback(() => {
    if (!instanceId) return;
    setLoading(true);
    load();
  }, [instanceId, load]);

  useEffect(() => {
    load();
  }, [load]);

  return { environments, loading, refresh };
}
