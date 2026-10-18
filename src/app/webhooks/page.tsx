"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Webhook {
  id: string;
  name: string;
  token: string;
  stackName: string;
  enabled: boolean;
  instanceName: string | null;
  createdAt: string;
}

interface Instance {
  id: string;
  name: string;
}

interface Stack {
  Id: number;
  Name: string;
  EndpointId: number;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const load = () =>
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then(setWebhooks)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <Button onClick={() => setShowWizard(!showWizard)}>
          {showWizard ? "Cancel" : "+ Create webhook"}
        </Button>
      </div>

      {showWizard && (
        <CreateWizard
          onDone={() => {
            setShowWizard(false);
            load();
          }}
        />
      )}

      {webhooks.length === 0 && !showWizard ? (
        <p className="text-sm text-muted-foreground">
          No webhooks yet. Create one to get a deploy URL.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((w) => (
            <Link key={w.id} href={`/webhooks/${w.id}`} className="group block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    {!w.enabled && (
                      <Badge variant="secondary">disabled</Badge>
                    )}
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {w.instanceName} → {w.stackName}
                  </div>
                  <code className="block truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    /api/hooks/{w.token.slice(0, 12)}…
                  </code>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedStack, setSelectedStack] = useState<Stack | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances);
  }, []);

  const pickInstance = async (id: string) => {
    setSelectedInstance(id);
    setStacks([]);
    const res = await fetch(`/api/instances/${id}/stacks`);
    const data = await res.json();
    setStacks(Array.isArray(data) ? data : []);
    setStep(2);
  };

  const pickStack = (stack: Stack) => {
    setSelectedStack(stack);
    setName(`${stack.Name} deploy`);
    setStep(3);
  };

  const handleCreate = async () => {
    if (!selectedStack || !selectedInstance) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          portainerInstanceId: selectedInstance,
          stackId: selectedStack.Id,
          endpointId: selectedStack.EndpointId,
          stackName: selectedStack.Name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ["Instance", "Stack", "Name"];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Create webhook</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Step indicators */}
        <div className="mb-6 flex items-center gap-2 text-xs">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  step > i + 1
                    ? "bg-green-500 text-white"
                    : step === i + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span
                className={step === i + 1 ? "font-medium" : "text-muted-foreground"}
              >
                {label}
              </span>
              {i < 2 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {instances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No instances configured.{" "}
                <Link href="/instances" className="underline">
                  Add one first
                </Link>
                .
              </p>
            ) : (
              instances.map((inst) => (
                <Button
                  key={inst.id}
                  variant="outline"
                  className="h-auto justify-start p-4"
                  onClick={() => pickInstance(inst.id)}
                >
                  {inst.name}
                </Button>
              ))
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            {stacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading stacks…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {stacks.map((s) => (
                  <Button
                    key={s.Id}
                    variant="outline"
                    className="h-auto justify-start p-4"
                    onClick={() => pickStack(s)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{s.Name}</div>
                      <div className="text-xs text-muted-foreground">
                        Stack #{s.Id} · Endpoint #{s.EndpointId}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="mt-3"
            >
              ← Back
            </Button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && selectedStack && (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Stack: <strong>{selectedStack.Name}</strong> (#{selectedStack.Id})
            </p>
            <div className="mb-4 max-w-sm space-y-1.5">
              <Label htmlFor="whName">Webhook name</Label>
              <Input
                id="whName"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving || !name}>
                {saving ? "Creating…" : "Create webhook"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                ← Back
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}