"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventLog } from "@/components/EventLog";

interface Webhook {
  id: string;
  name: string;
  stackName: string;
  enabled: boolean;
  instanceName: string | null;
}

const Dashboard = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{webhooks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {webhooks.filter((w) => w.enabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex gap-3">
        <Button nativeButton={false} render={<Link href="/instances" />}>+ Connect to instance</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/webhooks" />}>
          + Create webhook
        </Button>
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