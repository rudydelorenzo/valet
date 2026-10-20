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
import { Badge } from "@/components/ui/badge";
import {
  OidcProviderForm,
  type OidcProviderFormValues,
} from "@/components/OidcProviderForm";
import { toast } from "sonner";
import type { OidcProvider } from "@/lib/db/types";

const AdminSettingsPage = () => {
  const [providers, setProviders] = useState<OidcProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingProvider = editingId
    ? providers.find((p) => p.id === editingId)
    : undefined;

  const load = () =>
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then(setProviders)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (values: OidcProviderFormValues) => {
    const url = editingId
      ? `/api/admin/providers/${editingId}`
      : "/api/admin/providers";
    const method = editingId ? "PATCH" : "POST";
    const body = editingId
      ? { ...values, ...(values.clientSecret ? {} : { clientSecret: undefined }) }
      : values;
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
  };

  const handleEdit = (p: OidcProvider) => {
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleToggle = async (p: OidcProvider) => {
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
            <OidcProviderForm
              key={editingId ?? "new"}
              editing={!!editingId}
              initialValues={
                editingProvider
                  ? {
                      name: editingProvider.name,
                      issuer: editingProvider.issuer,
                      clientId: editingProvider.clientId,
                      scopes: editingProvider.scopes,
                      skipEmailVerification:
                        editingProvider.skipEmailVerification,
                    }
                  : undefined
              }
              submitLabel={editingId ? "Save changes" : "Add provider"}
              onCancel={resetForm}
              onSubmit={handleSubmit}
            />
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
              <CardContent className="flex items-center gap-4">
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