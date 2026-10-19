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
import { SetupCodeInput } from "@/components/SetupCodeInput";
import {
  OidcProviderForm,
  type OidcProviderFormValues,
} from "@/components/OidcProviderForm";
import { Terminal, KeyRound, CheckCircle2 } from "lucide-react";
import { SETUP_CODE_LENGTH } from "@/lib/constants";

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
    // Auto-redirect to the login page after a brief pause
    setTimeout(() => router.push("/login"), 2000);
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
          <ProviderStep onSaved={handleProviderSaved} />
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

const ProviderStep = ({ onSaved }: { onSaved: () => void }) => {
  const handleSubmit = async (values: OidcProviderFormValues) => {
    let res: Response;
    try {
      res = await fetch("/api/setup/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      throw new Error("Something went wrong");
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save provider");
    onSaved();
  };

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
        <OidcProviderForm
          submitLabel="Save & continue"
          fullWidthSubmit
          onSubmit={handleSubmit}
        />
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