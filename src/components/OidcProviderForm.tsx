"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyableContent } from "@/components/CopyableContent";
import { EmailVerificationSetting } from "@/components/EmailVerificationSetting";
import { CALLBACK_PATH, DEFAULT_OIDC_SCOPES } from "@/lib/constants";

export interface OidcProviderFormValues {
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  skipEmailVerification: boolean;
}

const EMPTY_VALUES: OidcProviderFormValues = {
  name: "",
  issuer: "",
  clientId: "",
  clientSecret: "",
  scopes: DEFAULT_OIDC_SCOPES,
  skipEmailVerification: false,
};

// ── OIDC provider form ─────────────────────────────────────────────
// Shared by the admin provider flow and the initial setup wizard so the
// fields live in exactly one place. Scopes are carried in the values (and
// still stored per provider on the backend) but not editable in the UI:
// the app only needs the fixed `openid email profile` set.

interface OidcProviderFormProps {
  /** Prefill, e.g. when editing an existing provider. */
  initialValues?: Partial<OidcProviderFormValues>;
  /** Edit mode: client secret becomes optional ("blank = keep"). */
  editing?: boolean;
  /** Submit button label (shown as "Saving…" while submitting). */
  submitLabel: string;
  /** Renders a ghost cancel button next to submit when provided. */
  onCancel?: () => void;
  /** Full-width large submit button (setup wizard CTA). */
  fullWidthSubmit?: boolean;
  /** Throw an Error with a user-facing message to show it inline. */
  onSubmit: (values: OidcProviderFormValues) => Promise<void>;
}

export const OidcProviderForm = ({
  initialValues,
  editing = false,
  submitLabel,
  onCancel,
  fullWidthSubmit = false,
  onSubmit,
}: OidcProviderFormProps) => {
  const [values, setValues] = useState<OidcProviderFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setText =
    (field: keyof OidcProviderFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
            value={values.name}
            onChange={setText("name")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provIssuer">Issuer URL</Label>
          <Input
            id="provIssuer"
            placeholder="https://auth.example.com/application/o/valet/"
            value={values.issuer}
            onChange={setText("issuer")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provClientId">Client ID</Label>
          <Input
            id="provClientId"
            value={values.clientId}
            onChange={setText("clientId")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provSecret">
            Client secret{editing ? " (blank = keep)" : ""}
          </Label>
          <Input
            id="provSecret"
            type="password"
            value={values.clientSecret}
            onChange={setText("clientSecret")}
            {...(editing ? {} : { required: true })}
          />
        </div>
        <EmailVerificationSetting
          skipEmailVerification={values.skipEmailVerification}
          onChange={(skipEmailVerification) =>
            setValues((v) => ({ ...v, skipEmailVerification }))
          }
        />
        {error && (
          <p className="col-span-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="col-span-full flex gap-2">
          <Button
            type="submit"
            disabled={saving}
            size={fullWidthSubmit ? "lg" : undefined}
            className={fullWidthSubmit ? "w-full" : undefined}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </>
  );
};
