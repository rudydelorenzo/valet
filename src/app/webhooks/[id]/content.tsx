"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";

interface Webhook {
  id: string;
  name: string;
  token: string;
  portainerInstanceId: string;
  stackId: number;
  endpointId: number;
  stackName: string;
  enabled: boolean;
  debounceSeconds: number;
  instanceName: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  status: string;
  message: string | null;
  triggerSource: string;
  createdAt: string;
}

const WebhookDetailContent = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = use(params);
  const router = useRouter();
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = () =>
    Promise.all([
      fetch(`/api/webhooks/${id}`).then((r) => r.json()),
      fetch(`/api/webhooks/${id}/events`).then((r) => r.json()),
    ])
      .then(([wh, ev]) => {
        setWebhook(wh);
        setEvents(ev);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [id]);

  const webhookUrl = webhook
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/hooks/${webhook.token}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  const handleToggle = async () => {
    if (!webhook) return;
    await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !webhook.enabled }),
    });
    load();
  };

  const handleTrigger = async () => {
    setTriggering(true);
    const res = await fetch(`/api/webhooks/${id}/trigger`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message || "Redeploy triggered");
    } else {
      toast.error(data.message || "Trigger failed");
    }
    setTriggering(false);
    setTimeout(() => {
      fetch(`/api/webhooks/${id}/events`)
        .then((r) => r.json())
        .then(setEvents);
    }, 1000);
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {webhook.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {webhook.instanceName} → {webhook.stackName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleToggle}>
            {webhook.enabled ? "Disable" : "Enable"}
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 text-sm">
            <span className="text-muted-foreground">Stack ID:</span>{" "}
            {webhook.stackId}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm">
            <span className="text-muted-foreground">Endpoint ID:</span>{" "}
            {webhook.endpointId}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm">
            <span className="text-muted-foreground">Debounce:</span>{" "}
            {webhook.debounceSeconds}s
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm">
            <span className="text-muted-foreground">Status:</span>{" "}
            <Badge variant={webhook.enabled ? "default" : "secondary"}>
              {webhook.enabled ? "Active" : "Disabled"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <Button onClick={handleTrigger} disabled={triggering}>
          {triggering ? "Triggering…" : "Trigger now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event log</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
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
                      <Badge
                        variant={
                          evt.status === "success"
                            ? "default"
                            : evt.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {evt.status}
                      </Badge>
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
};

export default WebhookDetailContent;