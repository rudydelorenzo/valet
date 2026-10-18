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

interface Instance {
  id: string;
  name: string;
  url: string;
  insecureTls: boolean;
  hasToken: boolean;
  createdAt: string;
}

interface Stack {
  Id: number;
  Name: string;
  EndpointId: number;
  Status: number;
}

export default function InstanceDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    token: "",
    insecureTls: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/instances/${id}`).then((r) => r.json()),
      fetch(`/api/instances/${id}/stacks`)
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([inst, stks]) => {
        setInstance(inst);
        setForm({
          name: inst.name,
          url: inst.url,
          token: "",
          insecureTls: inst.insecureTls,
        });
        setStacks(Array.isArray(stks) ? stks : []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await fetch(`/api/instances/${id}/test`, { method: "POST" });
    setTestResult(await res.json());
    setTesting(false);
  };

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
        <h1 className="text-2xl font-semibold tracking-tight">
          {instance.name}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {testResult && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            testResult.ok
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.message}
        </p>
      )}

      <Card className="mb-6">
        <CardContent className="pt-5">
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
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stacks.map((s) => (
                  <TableRow key={s.Id}>
                    <TableCell className="font-mono text-xs">{s.Id}</TableCell>
                    <TableCell>{s.Name}</TableCell>
                    <TableCell>{s.EndpointId}</TableCell>
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
}