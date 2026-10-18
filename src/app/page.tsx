"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Event {
  id: string;
  webhookId: string;
  status: string;
  message: string | null;
  triggerSource: string;
  createdAt: string;
}

interface Webhook {
  id: string;
  name: string;
  stackName: string;
  enabled: boolean;
  instanceName: string | null;
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((whks: Webhook[]) => {
        setWebhooks(whks);
        return Promise.all(
          whks.map((w) =>
            fetch(`/api/webhooks/${w.id}/events`).then((r) => r.json()),
          ),
        );
      })
      .then((nested) => {
        const all = nested.flat() as Event[];
        all.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setEvents(all.slice(0, 20));
      })
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{events.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex gap-3">
        <Button render={<Link href="/instances" />}>+ Add instance</Button>
        <Button variant="outline" render={<Link href="/webhooks" />}>
          + Create webhook
        </Button>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Create a webhook and trigger it to see events here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-mono text-xs">
                      {evt.id}
                    </TableCell>
                    <TableCell>{evt.triggerSource}</TableCell>
                    <TableCell>
                      <StatusBadge status={evt.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {evt.message ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(evt.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "success"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}