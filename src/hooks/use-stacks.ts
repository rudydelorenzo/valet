"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useEnvironments } from "@/hooks/use-environments";
import type { Stack } from "@/lib/db/types";

/**
 * Fetches and manages Portainer stacks for an instance. Uses the
 * environments hook internally to enrich each stack with its
 * environment name. Refreshing refreshes both.
 */
export function useStacks(instanceId: string | undefined) {
  const { environments, refresh: refreshEnvironments } =
    useEnvironments(instanceId);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/instances/${instanceId}/stacks`);
      if (!res.ok) throw new Error("Failed to load stacks");
      const data = await res.json();
      setStacks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Enrich stacks with environment names
  const enrichedStacks = useMemo(
    () =>
      stacks.map((stack) => ({
        ...stack,
        environmentName: environments.find((e) => e.Id === stack.EndpointId)
          ?.Name,
      })),
    [stacks, environments],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshEnvironments()]);
  }, [refresh, refreshEnvironments]);

  return {
    stacks: enrichedStacks,
    environments,
    loading,
    error,
    refresh: refreshAll,
  };
}