"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeploymentDialog } from "@/components/deploy-wizard/DeploymentDialog";

interface Webhook {
  id: string;
  name: string;
  token: string;
  stackName: string;
  enabled: boolean;
  instanceName: string | null;
  createdAt: string;
}

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
        <h1 className="text-2xl font-semibold tracking-tight">Deployment hooks</h1>
        <Button onClick={() => setDialogOpen(true)}>+ Create deployment hook</Button>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((w) => (
            <Link key={w.id} href={`/webhooks/${w.id}`} className="group block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    {!w.enabled && (
                      <Badge variant="secondary">disabled</Badge>
                    )}
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {w.instanceName} → {w.stackName}
                  </div>
                  <code className="block truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    /api/hooks/{w.token.slice(0, 12)}…
                  </code>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhooksPage;