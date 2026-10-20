"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useEnvironments } from "@/hooks/use-environments";
import type { Stack } from "@/types";

/**
 * Fetches and manages Portainer stacks for an instance. Uses the
 * environments hook internally to enrich each stack with its
 * environment name. Refreshing refreshes both.
 */
export function useStacks(instanceId: string | undefined) {
  const { environments, refresh: refreshEnvironments } =
    useEnvironments(instanceId);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(Boolean(instanceId));
  const [error, setError] = useState("");
  const [prevId, setPrevId] = useState(instanceId);

  // A new instance id starts a new load — adjust state during render
  // (React's sanctioned pattern for state derived from a prop change).
  if (instanceId !== prevId) {
    setPrevId(instanceId);
    setLoading(instanceId !== undefined);
    setError("");
  }

  // Fetch; state updates happen in promise callbacks, so this is safe
  // to call from an effect as well as from event handlers.
  const load = useCallback(() => {
    if (!instanceId) return;
    fetch(`/api/instances/${instanceId}/stacks`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stacks");
        return res.json();
      })
      .then((data) => {
        setStacks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [instanceId]);

  // Manual refresh — sets loading immediately (fine: called from handlers)
  const refresh = useCallback(() => {
    if (!instanceId) return;
    setLoading(true);
    setError("");
    load();
  }, [instanceId, load]);

  useEffect(() => {
    load();
  }, [load]);

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
