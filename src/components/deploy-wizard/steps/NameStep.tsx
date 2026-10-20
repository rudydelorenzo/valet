import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreatedWebhook, Stack } from "@/types/api";

const NameStep = ({
  instanceId,
  instanceName,
  stack,
  onCreate,
  onBack,
}: {
  instanceId: string;
  instanceName: string;
  stack: Stack;
  onCreate: (webhook: CreatedWebhook) => void;
  onBack: () => void;
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          portainerInstanceId: instanceId,
          stackId: stack.Id,
          endpointId: stack.EndpointId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      onCreate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Give your deployment hook a name. We recommend naming it based on its intended use.
      </p>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">{instanceName}</span>
        <span className="mx-2 text-muted-foreground">→</span>
        <span className="font-medium">{stack.Name}</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deploy-name">Hook name</Label>
        <Input
          id="deploy-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GitHub Actions, CI, Docker Hub"
          autoFocus
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create hook"}
        </Button>
      </div>
    </div>
  );
};

export { NameStep };