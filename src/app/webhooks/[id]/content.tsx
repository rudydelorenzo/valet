"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventLog } from "@/components/EventLog";
import { LogoBackButton } from "@/components/ui/logo-back-button";
import { InstanceIcon } from "@/components/ui/instance-icon";
import { Toggle } from "@/components/ui/toggle";
import { DeployIntegrationDialog } from "@/components/deploy-integration/DeployIntegrationDialog";
import { useEnvironments } from "@/hooks/use-environments";
import { PillBadge } from "@/components/ui/pill-badge";
import { Code } from "lucide-react";
import { toast } from "sonner";
import type { WebhookDetail } from "@/types";

interface StackHealth {
  healthy: boolean;
  stackName?: string;
  error?: string;
}

const WebhookDetailContent = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = use(params);
  const router = useRouter();
  const [webhook, setWebhook] = useState<WebhookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [eventLogKey, setEventLogKey] = useState(0);
  const [integrationOpen, setIntegrationOpen] = useState(false);

  const { environments } = useEnvironments(
    webhook?.portainerInstanceId ?? undefined,
  );
  const environmentName = webhook
    ? environments.find((e) => e.Id === webhook.endpointId)?.Name
    : undefined;

  const [stackHealth, setStackHealth] = useState<StackHealth | null>(null);

  // Check stack health once on load. Depends on the whole `webhook`
  // since the effect reads several fields from it; it's set once per
  // page load, so this still runs exactly once per webhook.
  useEffect(() => {
    if (!webhook) return;
    const { portainerInstanceId, endpointId, stackId } = webhook;
    fetch(
      `/api/instances/${portainerInstanceId}/environments/${endpointId}/stacks/${stackId}`,
    )
      .then(async (r): Promise<StackHealth> => {
        if (r.ok) {
          const data = await r.json();
          return { healthy: true, stackName: data.Name };
        }
        return { healthy: false, error: r.status === 404 ? "Stack not found" : "Unreachable" };
      })
      .then(setStackHealth)
      .catch(() => setStackHealth({ healthy: false, error: "Connection failed" }));
  }, [webhook]);

  useEffect(() => {
    fetch(`/api/webhooks/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((wh) => setWebhook(wh && !wh.error ? wh : null))
      .finally(() => setLoading(false));
  }, [id]);

  const webhookUrl = webhook
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/deploy/${webhook.token}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  const handleToggle = async (enabled: boolean) => {
    if (!webhook) return;
    await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    // Refresh webhook data
    fetch(`/api/webhooks/${id}`)
      .then((r) => r.json())
      .then(setWebhook);
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/webhooks/${id}/trigger`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Redeploy triggered");
      } else {
        toast.error(data.message || "Trigger failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggering(false);
    }
    // Nudge the event log to refresh
    setEventLogKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    router.push("/webhooks");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!webhook) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <LogoBackButton
          href="/webhooks"
          title="Back to deployment hooks"
          logo={
            <InstanceIcon
              id={webhook.portainerInstanceId}
              className="size-full object-cover"
            />
          }
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            {webhook.name}
          </h1>
        </LogoBackButton>
        <div className="flex items-center gap-3">
          <Toggle
            checked={webhook.enabled}
            onChange={handleToggle}
            label={webhook.enabled ? "Enabled" : "Disabled"}
          />
          <div className="h-6 w-px bg-border" />
          <Button
            variant="outline"
            onClick={handleTrigger}
            disabled={triggering}
          >
            {triggering ? "Triggering…" : "Trigger now"}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Webhook URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
              {webhookUrl}
            </code>
            <Button variant="outline" onClick={handleCopy}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            POST to this URL to trigger a redeploy. The token authenticates the
            request.
          </p>
        </CardContent>
      </Card>

      {/* Big integration CTA */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setIntegrationOpen(true)}
          className="btn-tactile group flex w-full items-center gap-4 rounded-xl p-5 text-left text-primary-foreground cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Code className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">Use your deploy hook</div>
            <div className="text-sm text-primary-foreground/70">
              Get code snippets to integrate into your CI pipeline or scripts
            </div>
          </div>
        </button>
      </div>

      <DeployIntegrationDialog
        open={integrationOpen}
        onOpenChange={setIntegrationOpen}
        webhook={webhook}
        origin={typeof window !== "undefined" ? window.location.origin : ""}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="text-sm">
            <span className="text-muted-foreground">Instance:</span>{" "}
            {webhook.instanceName ?? "Unknown"}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-sm">
            <span className="text-muted-foreground">Stack:</span>{" "}
            <code>{stackHealth?.stackName ?? "Loading…"}</code>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-sm">
            <span className="text-muted-foreground">Environment:</span>{" "}
            <code>{environmentName ?? "Loading…"}</code>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stack connection:</span>{" "}
            {stackHealth === null ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : stackHealth.healthy ? (
              <PillBadge color="green" dot>Healthy</PillBadge>
            ) : (
              <PillBadge color="red" dot>Unhealthy</PillBadge>
            )}
          </CardContent>
        </Card>
      </div>

      {webhook.status === "degraded" && (
        <p className="mb-6 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {webhook.eventsFailed}/{webhook.eventsTotal} events failed in the
          last 24h — this hook may be misbehaving.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event log</CardTitle>
        </CardHeader>
        <CardContent>
          <EventLog
            key={eventLogKey}
            fetchUrl={`/api/webhooks/${id}/events`}
            live
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookDetailContent;