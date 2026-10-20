"use client";

import { useEffect, useState, useCallback } from "react";
import type { Environment } from "@/lib/db/types";

/**
 * Fetches and manages Portainer environments for an instance.
 * Returns the list, loading state, and a refresh function.
 */
export function useEnvironments(instanceId: string | undefined) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/environments`);
      const data = await res.json();
      setEnvironments(Array.isArray(data) ? data : []);
    } catch {
      // keep existing environments on error
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { environments, loading, refresh };
}