import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Instance } from "@/lib/db/types";

const AddInstanceStep = ({
  onDone,
  onBack,
}: {
  onDone: (instance: Instance) => void;
  onBack: () => void;
}) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [insecureTls, setInsecureTls] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, token, insecureTls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add instance");
      onDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the connection details for your Portainer instance.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="inst-name">Name</Label>
          <Input
            id="inst-name"
            placeholder="My Portainer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inst-url">URL</Label>
          <Input
            id="inst-url"
            placeholder="https://localhost:9443"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inst-token">Access token</Label>
          <Input
            id="inst-token"
            type="password"
            placeholder="ptr_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={insecureTls}
            onChange={(e) => setInsecureTls(e.target.checked)}
            className="size-4"
          />
          Skip TLS verification
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Connecting…" : "Connect instance"}
        </Button>
      </div>
    </form>
  );
};

export { AddInstanceStep };