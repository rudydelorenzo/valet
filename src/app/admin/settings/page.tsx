"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyableContent } from "@/components/CopyableContent";
import { toast } from "sonner";
import { DEFAULT_OIDC_SCOPES } from "@/lib/constants";

interface Provider {
  id: string;
  name: string;
  issuer: string;
  clientId: string;
  scopes: string;
  skipEmailVerification: boolean;
  enabled: boolean;
  createdAt: string;
}

const AdminSettingsPage = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    clientId: "",
    clientSecret: "",
    scopes: DEFAULT_OIDC_SCOPES,
    skipEmailVerification: true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then(setProviders)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      issuer: "",
      clientId: "",
      clientSecret: "",
      scopes: DEFAULT_OIDC_SCOPES,
      skipEmailVerification: true,
    });
    setError("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/providers/${editingId}`
        : "/api/admin/providers";
      const method = editingId ? "PATCH" : "POST";
      const body = editingId
        ? { ...form, ...(form.clientSecret ? {} : { clientSecret: undefined }) }
        : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save provider");
      toast.success(editingId ? "Provider updated" : "Provider added");
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: Provider) => {
    setForm({
      name: p.name,
      issuer: p.issuer,
      clientId: p.clientId,
      clientSecret: "",
      scopes: p.scopes,
      skipEmailVerification: p.skipEmailVerification,
    });
    setEditingId(p.id);
    setShowForm(true);
    setError("");
  };

  const handleToggle = async (p: Provider) => {
    await fetch(`/api/admin/providers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this identity provider?")) return;
    await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
    toast.success("Provider deleted");
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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Identity providers
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure OIDC providers for login (Authentik, Auth0, Google, etc.)
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Add provider
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit provider" : "New provider"}
            </CardTitle>
            <CardDescription>
              Enter your OIDC provider&apos;s details. The issuer URL must
              support{" "}
              <code className="text-xs">/.well-known/openid-configuration</code>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyableContent
              label="Redirect / callback URL"
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/callback`}
            />
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="provName">Display name</Label>
                <Input
                  id="provName"
                  placeholder="Authentik"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provIssuer">Issuer URL</Label>
                <Input
                  id="provIssuer"
                  placeholder="https://auth.example.com/application/o/valet/"
                  value={form.issuer}
                  onChange={(e) =>
                    setForm({ ...form, issuer: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provClientId">Client ID</Label>
                <Input
                  id="provClientId"
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provSecret">
                  Client secret{editingId ? " (blank = keep)" : ""}
                </Label>
                <Input
                  id="provSecret"
                  type="password"
                  value={form.clientSecret}
                  onChange={(e) =>
                    setForm({ ...form, clientSecret: e.target.value })
                  }
                  {...(editingId ? {} : { required: true })}
                />
              </div>
              <div className="col-span-full space-y-1.5">
                <Label htmlFor="provScopes">Scopes</Label>
                <Input
                  id="provScopes"
                  value={form.scopes}
                  onChange={(e) =>
                    setForm({ ...form, scopes: e.target.value })
                  }
                />
              </div>
              <div className="col-span-full flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skipEmailVerification"
                  checked={form.skipEmailVerification}
                  onChange={(e) =>
                    setForm({ ...form, skipEmailVerification: e.target.checked })
                  }
                  className="size-4"
                />
                <Label htmlFor="skipEmailVerification" className="font-normal">
                  Skip email verification check
                </Label>
              </div>
              {error && (
                <p className="col-span-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Save changes"
                      : "Add provider"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {providers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              No identity providers configured. Add one to enable login.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant={p.enabled ? "default" : "secondary"}>
                      {p.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.issuer}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Client ID: {p.clientId} · Scopes: {p.scopes}
                    {p.skipEmailVerification && " · Email verification skipped"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(p)}
                  >
                    {p.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;