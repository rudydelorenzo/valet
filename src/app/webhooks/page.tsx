"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeploymentDialog } from "@/components/deploy-wizard/DeploymentDialog";
import { WebhookStatusBadge } from "@/components/WebhookStatusBadge";
import { InstanceIcon } from "@/components/ui/instance-icon";
import { ReachabilityBadge } from "@/components/ReachabilityBadge";
import { useReachability } from "@/hooks/use-reachability";
import { useStacks } from "@/hooks/use-stacks";
import { Webhook } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  token: string;
  portainerInstanceId: string;
  stackId: number;
  enabled: boolean;
  status: string;
  instanceName: string | null;
  createdAt: string;
  eventsTotal?: number;
  eventsFailed?: number;
}

const WebhookGroup = ({
  instanceId,
  instanceName,
  webhooks,
  reachabilityStatus,
}: {
  instanceId: string;
  instanceName: string;
  webhooks: Webhook[];
  reachabilityStatus?: { reachable: boolean; version?: string };
}) => {
  const { stacks } = useStacks(
    instanceId === "__none__" ? undefined : instanceId,
  );

  return (
    <section>
      {/* Instance header */}
      <div className="mb-3 flex items-center gap-2.5">
        {instanceId !== "__none__" && (
          <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            <InstanceIcon id={instanceId} />
          </div>
        )}
        <h2 className="text-sm font-semibold">{instanceName}</h2>
        {instanceId !== "__none__" && (
          <ReachabilityBadge status={reachabilityStatus} />
        )}
        <span className="text-xs text-muted-foreground">
          {webhooks.length} hook{webhooks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Webhook cards */}
      <div className="grid gap-3">
        {webhooks.map((w) => {
          const stackName =
            stacks.find((s) => s.Id === w.stackId)?.Name ?? "Loading…";

          return (
            <Link
              key={w.id}
              href={`/webhooks/${w.id}`}
              className="group block"
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <Webhook className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <div className="text-base font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stackName}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <WebhookStatusBadge status={w.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {w.status === "degraded" && w.eventsTotal
                        ? `${w.eventsFailed}/${w.eventsTotal} failed in 24h · `
                        : ""}
                      Created{" "}
                      {new Date(w.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

const WebhooksPage = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = () =>
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then(setWebhooks)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Group webhooks by instance, preserving order
  const groups = useMemo(() => {
    const map = new Map<string, Webhook[]>();
    for (const w of webhooks) {
      const key = w.portainerInstanceId ?? "__none__";
      const list = map.get(key) ?? [];
      list.push(w);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [webhooks]);

  const instanceIds = useMemo(
    () =>
      groups
        .map(([key]) => key)
        .filter((key) => key !== "__none__"),
    [groups],
  );

  const reachability = useReachability(instanceIds);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Deployment hooks
        </h1>
        <Button onClick={() => setDialogOpen(true)}>
          + Create deployment hook
        </Button>
      </div>

      <DeploymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={load}
      />

      {webhooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No deployment hooks yet. Create one to get a deploy URL.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([instanceId, groupWebhooks]) => (
            <WebhookGroup
              key={instanceId}
              instanceId={instanceId}
              instanceName={
                groupWebhooks[0].instanceName ?? "Unknown instance"
              }
              webhooks={groupWebhooks}
              reachabilityStatus={
                instanceId !== "__none__"
                  ? reachability[instanceId]
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhooksPage;