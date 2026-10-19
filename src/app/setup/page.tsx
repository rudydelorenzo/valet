"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { SetupCodeInput } from "@/components/SetupCodeInput";
import { CopyableContent } from "@/components/CopyableContent";
import { Terminal, KeyRound, CheckCircle2 } from "lucide-react";
import { CALLBACK_PATH, DEFAULT_OIDC_SCOPES, SETUP_CODE_LENGTH } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────

type Step = "verify" | "provider" | "done";

// ── Step indicators ────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "verify", label: "Verify" },
  { key: "provider", label: "Provider" },
  { key: "done", label: "Done" },
];

const StepIndicator = ({ current }: { current: Step }) => {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
              i < currentIdx
                ? "bg-green-500 text-white"
                : i === currentIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < currentIdx ? "✓" : i + 1}
          </div>
          <span
            className={i === currentIdx ? "font-medium" : "text-muted-foreground"}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="text-muted-foreground/40">→</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────

const SetupPage = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>("verify");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Check setup status on mount
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) {
          router.replace("/");
          return;
        }
        // Already verified → jump to provider step
        setStep(data.verified ? "provider" : "verify");
      })
      .catch(() => setStep("verify"))
      .finally(() => setLoading(false));
  }, [router]);

  // After verify step succeeds
  const handleVerified = () => setStep("provider");

  // After provider step succeeds
  const handleProviderSaved = () => {
    setStep("done");
    // Auto-redirect to login after a brief pause
    setTimeout(() => router.push("/api/auth/login"), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground animate-in fade-in duration-300">
        Checking setup status…
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Valet
          </h1>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step content */}
        {step === "verify" && (
          <VerifyStep
            error={error}
            setError={setError}
            onVerified={handleVerified}
          />
        )}

        {step === "provider" && (
          <ProviderStep
            error={error}
            setError={setError}
            onSaved={handleProviderSaved}
          />
        )}

        {step === "done" && <DoneStep />}

        {/* Footer */}
        {step !== "done" && (
          <p className="text-center text-xs text-muted-foreground/60 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
            {step === "verify"
              ? "This code ensures only the server owner can configure Valet."
              : "You can add more providers after setup from the admin panel."}
          </p>
        )}
      </div>
    </div>
  );
}

export default SetupPage;

// ── Step1: Verify ──────────────────────────────────────────────────

const VerifyStep = ({
  error,
  setError,
  onVerified,
}: {
  error: string;
  setError: (v: string) => void;
  onVerified: () => void;
}) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const submit = async (codeOverride?: string) => {
    const codeToSubmit = codeOverride ?? code;
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToSubmit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      onVerified();
    } catch {
      setError("Something went wrong");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Instance verification</CardTitle>
        <CardDescription className="flex items-center justify-center gap-1.5">
          <Terminal className="size-3.5" />
          Check the server logs for a setup code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-6"
        >
          <div className="space-y-3">
            <SetupCodeInput
              value={code}
              onChange={setCode}
              onComplete={submit}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={verifying || code.replace(/\s/g, "").length < SETUP_CODE_LENGTH}
          >
            {verifying ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// ── Step 2: Provider ───────────────────────────────────────────────

const ProviderStep = ({
  error,
  setError,
  onSaved,
}: {
  error: string;
  setError: (v: string) => void;
  onSaved: () => void;
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    clientId: "",
    clientSecret: "",
    scopes: DEFAULT_OIDC_SCOPES,
    skipEmailVerification: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/setup/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save provider");
        return;
      }
      onSaved();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
      <CardHeader className="text-center">
        <CardTitle className="text-lg flex items-center justify-center gap-2">
          <KeyRound className="size-4" />
          Configure login provider
        </CardTitle>
        <CardDescription>
          Set up an OIDC identity provider to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CopyableContent
          label="Redirect / callback URL"
          value={`${typeof window !== "undefined" ? window.location.origin : ""}${CALLBACK_PATH}`}
        />

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provName">Display name</Label>
            <Input
              id="provName"
              placeholder="Authentik"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provIssuer">Issuer URL</Label>
            <Input
              id="provIssuer"
              placeholder="https://auth.example.com/application/o/valet/"
              value={form.issuer}
              onChange={set("issuer")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provClientId">Client ID</Label>
            <Input
              id="provClientId"
              value={form.clientId}
              onChange={set("clientId")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provSecret">Client secret</Label>
            <Input
              id="provSecret"
              type="password"
              value={form.clientSecret}
              onChange={set("clientSecret")}
              required
            />
          </div>
          <div className="col-span-full space-y-1.5">
            <Label htmlFor="provScopes">Scopes</Label>
            <Input
              id="provScopes"
              value={form.scopes}
              onChange={set("scopes")}
            />
          </div>
          <div className="col-span-full flex items-center gap-2">
            <input
              type="checkbox"
              id="skipEmailVerification"
              checked={form.skipEmailVerification}
              onChange={(e) => setForm({ ...form, skipEmailVerification: e.target.checked })}
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

          <div className="col-span-full">
            <Button type="submit" className="w-full" size="lg" disabled={saving}>
              {saving ? "Saving…" : "Save & continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// ── Step 3: Done ───────────────────────────────────────────────────

const DoneStep = () => {
  return (
    <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
      <CardContent className="flex flex-col items-center gap-4 py-10">
        <div className="animate-in zoom-in duration-500 delay-200 fill-mode-both">
          <CheckCircle2 className="size-12 text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">You&apos;re all set</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Redirecting you to login…
          </p>
        </div>
      </CardContent>
    </Card>
  );
};