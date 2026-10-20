"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReachability } from "@/hooks/use-reachability";
import { useStacks } from "@/hooks/use-stacks";
import { PillBadge } from "@/components/ui/pill-badge";
import { ReachabilityBadge } from "@/components/ReachabilityBadge";
import { LogoBackButton } from "@/components/ui/logo-back-button";
import { InstanceIcon } from "@/components/ui/instance-icon";
import { RefreshCw } from "lucide-react";
import type { Instance } from "@/lib/db/types";

const ENVIRONMENT_TYPES: Record<number, string> = {
  1: "Docker",
  2: "Swarm",
  3: "Kubernetes",
  4: "Azure",
  5: "Edge",
};

const InstanceDetailContent = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = use(params);
  const router = useRouter();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    token: "",
    insecureTls: false,
  });
  const [saving, setSaving] = useState(false);
  const { stacks, environments, refresh: refreshData } = useStacks(id);
  const [refreshing, setRefreshing] = useState(false);
  const reachability = useReachability(instance ? [instance.id] : []);
  const status = instance ? reachability[instance.id] : undefined;

  const loadData = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetch(`/api/instances/${id}`)
      .then((r) => r.json())
      .then((inst) => {
        setInstance(inst);
        setForm({
          name: inst.name,
          url: inst.url,
          token: "",
          insecureTls: inst.insecureTls,
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name,
      url: form.url,
      insecureTls: form.insecureTls,
    };
    if (form.token) body.token = form.token;
    await fetch(`/api/instances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setEditing(false);
    const inst = await fetch(`/api/instances/${id}`).then((r) => r.json());
    setInstance(inst);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this instance and all associated webhooks?")) return;
    await fetch(`/api/instances/${id}`, { method: "DELETE" });
    router.push("/instances");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!instance) {
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
          href="/instances"
          title="Back to instances"
          logo={
            <InstanceIcon
              id={instance.id}
              className="size-full object-cover"
            />
          }
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            {instance.name}
          </h1>
          <ReachabilityBadge status={status} />
        </LogoBackButton>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">URL:</span> {instance.url}
            </div>
            <div>
              <span className="text-muted-foreground">TLS skip:</span>{" "}
              {instance.insecureTls ? "Yes" : "No"}
            </div>
            <div>
              <span className="text-muted-foreground">ID:</span>{" "}
              <code className="font-mono text-xs">{instance.id}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              {new Date(instance.createdAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit instance</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editUrl">URL</Label>
                <Input
                  id="editUrl"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editToken">New token (blank = keep)</Label>
                <Input
                  id="editToken"
                  type="password"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  id="editTls"
                  checked={form.insecureTls}
                  onChange={(e) =>
                    setForm({ ...form, insecureTls: e.target.checked })
                  }
                  className="size-4"
                />
                <Label htmlFor="editTls" className="font-normal">
                  Skip TLS verification
                </Label>
              </div>
              <div className="col-span-full">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Environments</CardTitle>
        </CardHeader>
        <CardContent>
          {environments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No environments found (or connection failed).
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {environments.map((env) => (
                <div
                  key={env.Id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{env.Name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ENVIRONMENT_TYPES[env.Type] ?? `Type ${env.Type}`} · #{env.Id}
                    </div>
                  </div>
                  <PillBadge
                    color={env.Status === 1 ? "green" : "red"}
                    dot
                  >
                    {env.Status === 1 ? "Up" : "Down"}
                  </PillBadge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stacks</CardTitle>
        </CardHeader>
        <CardContent>
          {stacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stacks found (or connection failed).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stacks.map((s) => (
                  <TableRow key={s.Id}>
                    <TableCell className="font-mono text-xs">{s.Id}</TableCell>
                    <TableCell>{s.Name}</TableCell>
                    <TableCell>
                      {s.environmentName ?? `#${s.EndpointId}`}
                    </TableCell>
                    <TableCell>
                      {s.Status === 1 ? "Active" : `Status ${s.Status}`}
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

export default InstanceDetailContent;