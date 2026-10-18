"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Instance {
  id: string;
  name: string;
  url: string;
  insecureTls: boolean;
  createdAt: string;
}

const InstancesPage = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    token: "",
    insecureTls: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add instance");
      setForm({ name: "", url: "", token: "", insecureTls: false });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this instance? Associated webhooks will also be deleted.",
      )
    )
      return;
    await fetch(`/api/instances/${id}`, { method: "DELETE" });
    load();
  };

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
          Portainer instances
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add instance"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>New instance</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="My Portainer"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  placeholder="https://localhost:9443"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token">Access token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ptr_…"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  id="insecureTls"
                  checked={form.insecureTls}
                  onChange={(e) =>
                    setForm({ ...form, insecureTls: e.target.checked })
                  }
                  className="size-4"
                />
                <Label htmlFor="insecureTls" className="font-normal">
                  Skip TLS verification
                </Label>
              </div>
              {error && (
                <p className="col-span-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="col-span-full">
                <Button type="submit" disabled={saving}>
                  {saving ? "Adding…" : "Add instance"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {instances.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No instances configured yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => (
            <Link
              key={inst.id}
              href={`/instances/${inst.id}`}
              className="group block"
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="mb-1 font-medium">{inst.name}</div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    {inst.url}
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.insecureTls && (
                      <Badge variant="secondary">TLS skip</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(inst.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstancesPage;