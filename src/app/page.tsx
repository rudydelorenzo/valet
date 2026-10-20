"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventLog } from "@/components/EventLog";
import { DeploymentDialog } from "@/components/deploy-wizard/DeploymentDialog";
import { Plus, Server, ArrowRight, Webhook } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  stackName: string;
  enabled: boolean;
  status: string;
  instanceName: string | null;
}

const Dashboard = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((whks: Webhook[]) => setWebhooks(whks))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const activeCount = webhooks.filter((w) => w.status === "active").length;
  const degradedCount = webhooks.filter((w) => w.status === "degraded").length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {webhooks.length} hook{webhooks.length !== 1 ? "s" : ""}{" "}
            <span className="mx-1 text-muted-foreground/40">·</span>{" "}
            {activeCount} active
            {degradedCount > 0 && (
              <>
                <span className="mx-1 text-muted-foreground/40">·</span>{" "}
                <span className="text-amber-700 dark:text-amber-400">
                  {degradedCount} degraded
                </span>
              </>
            )}
          </p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Create deployment hook
        </Button>
      </div>

      <DeploymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Primary action */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="btn-tactile group flex w-full items-center gap-4 rounded-xl p-5 text-left text-primary-foreground cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Plus className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">Create deployment hook</div>
            <div className="text-sm text-primary-foreground/70">
              Set up a new webhook to trigger deployments from your CI pipeline
            </div>
          </div>
          <ArrowRight className="size-5 shrink-0 text-primary-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-foreground/80" />
        </button>
      </div>

      {/* Secondary actions */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/webhooks"
          className="group flex items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-all hover:bg-muted/50 active:scale-[0.99]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Webhook className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Manage hooks</div>
            <div className="text-xs text-muted-foreground">
              View, edit, or disable
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </Link>

        <Link
          href="/instances"
          className="group flex items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-all hover:bg-muted/50 active:scale-[0.99]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Server className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Manage instances</div>
            <div className="text-xs text-muted-foreground">
              Add or configure Portainer instances
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </Link>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          <EventLog fetchUrl="/api/events" limit={20} />
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;