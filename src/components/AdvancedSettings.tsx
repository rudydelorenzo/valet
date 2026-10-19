"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const REQUIRED_SCOPES = ["openid", "email"];

interface AdvancedSettingsProps {
  scopes: string;
  onScopesChange: (scopes: string) => void;
  skipEmailVerification: boolean;
  onSkipEmailVerificationChange: (skip: boolean) => void;
}

export const AdvancedSettings = ({
  scopes,
  onScopesChange,
  skipEmailVerification,
  onSkipEmailVerificationChange,
}: AdvancedSettingsProps) => {
  const [expanded, setExpanded] = useState(false);

  // Parse current scopes
  const scopeList = scopes.split(/\s+/).filter(Boolean);
  const hasProfile = scopeList.includes("profile");
  const customScopes = scopeList
    .filter((s) => !["openid", "email", "profile"].includes(s))
    .join(" ");

  const rebuildScopes = (profile: boolean, custom: string) => {
    const parts = [...REQUIRED_SCOPES];
    if (profile) parts.push("profile");
    const extra = custom
      .trim()
      .split(/\s+/)
      .filter((s) => s && !REQUIRED_SCOPES.includes(s) && s !== "profile");
    if (extra.length) parts.push(...extra);
    onScopesChange(parts.join(" "));
  };

  return (
    <div className="col-span-full">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
        Advanced settings
      </button>

      {expanded && (
        <div className="space-y-5 rounded-lg border border-dashed bg-muted/30 p-4 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Scopes */}
          <div className="space-y-3">
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_SCOPES.map((scope) => (
                <label
                  key={scope}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="size-3.5 accent-primary"
                  />
                  {scope}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    required
                  </Badge>
                </label>
              ))}
              <label className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={hasProfile}
                  onChange={(e) => rebuildScopes(e.target.checked, customScopes)}
                  className="size-3.5 accent-primary"
                />
                profile
              </label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="customScopes" className="text-xs text-muted-foreground">
                Additional scopes (space-separated)
              </Label>
              <Input
                id="customScopes"
                placeholder="groups offline_access"
                value={customScopes}
                onChange={(e) => rebuildScopes(hasProfile, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Email verification */}
          <Toggle
            checked={!skipEmailVerification}
            onChange={(checked) => onSkipEmailVerificationChange(!checked)}
            label="Require verified email"
            description="Reject login if the provider reports the email as unverified. Disable if your provider doesn't report email_verified."
          />
        </div>
      )}
    </div>
  );
};