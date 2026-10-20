"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { loginUrl } from "@/lib/urls";
import { LogIn, Clock } from "lucide-react";
import type { ProviderSummary } from "@/lib/db/types";

const LAST_USED_KEY = "valet:lastProviderId";

// localStorage-backed store for the last-used provider (cross-tab aware),
// read via useSyncExternalStore so SSR/hydration stays consistent.
const subscribeToLastUsed = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};
const getLastUsed = () => localStorage.getItem(LAST_USED_KEY);
const getLastUsedServer = () => null;

const LoginPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
};

const LoginContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorMsg = searchParams.get("error");
  const errorProviderId = searchParams.get("provider");

  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const lastUsedId = useSyncExternalStore(
    subscribeToLastUsed,
    getLastUsed,
    getLastUsedServer,
  );

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((data: ProviderSummary[]) => {
        if (data.length === 0) {
          router.replace("/setup");
          return;
        }

        // Always show the picker, even with a single provider, so the user
        // explicitly chooses to sign in.
        setProviders(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  // Order: last-used first, rest after
  const ordered = useMemo(() => {
    if (!lastUsedId) return providers;
    const last = providers.find((p) => p.id === lastUsedId);
    if (!last) return providers;
    return [last, ...providers.filter((p) => p.id !== lastUsedId)];
  }, [providers, lastUsedId]);

  const handleLogin = (providerId: string) => {
    localStorage.setItem(LAST_USED_KEY, providerId);
    window.location.assign(loginUrl(providerId));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground animate-in fade-in duration-300">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to Valet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an identity provider to continue
          </p>
        </div>

        <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
          <CardContent className="flex flex-col">
            {ordered.map((p, i) => {
              const isLastUsed = p.id === lastUsedId;
              const hasError = p.id === errorProviderId && errorMsg;
              const showDivider = i === 1 && ordered.length > 1;

              return (
                <div key={p.id}>
                  {showDivider && (
                    <div className="flex items-center gap-3 py-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Other sign-in options
                      </span>
                      <Separator className="flex-1" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full justify-start gap-3"
                      onClick={() => handleLogin(p.id)}
                    >
                      <LogIn className="size-4 text-muted-foreground" />
                      Continue with {p.name}
                      {isLastUsed && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          Last used
                        </span>
                      )}
                    </Button>
                    {hasError && (
                      <p className="px-2 pb-1 text-sm text-destructive animate-in fade-in duration-200">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;