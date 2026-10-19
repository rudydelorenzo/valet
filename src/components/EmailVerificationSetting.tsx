"use client";

import { MailCheck, ShieldOff } from "lucide-react";
import { ChoiceCards, type ChoiceOption } from "@/components/ui/choice-cards";
import { Label } from "@/components/ui/label";

type EmailVerificationMode = "require" | "skip";

const EMAIL_VERIFICATION_OPTIONS: ChoiceOption<EmailVerificationMode>[] = [
  {
    value: "require",
    label: "Require verification",
    description:
      "Only accept sign-in when the provider reports the email as verified.",
    icon: MailCheck,
    tag: "Recommended",
  },
  {
    value: "skip",
    label: "Trust provider",
    description:
      "Accept the email as-is — anyone could sign in with an address they don't own, opening the door to account takeover. Only use if your provider doesn't report email_verified.",
    icon: ShieldOff,
  },
];

// ── Email verification setting ─────────────────────────────────────
// Scopes are intentionally not configurable: the app only needs the fixed
// `openid email profile` set. The backend still stores and applies
// per-provider scopes (normalized with required scopes enforced), so a
// picker can be re-introduced in the provider forms later without schema
// changes.

interface EmailVerificationSettingProps {
  skipEmailVerification: boolean;
  onChange: (skip: boolean) => void;
}

export const EmailVerificationSetting = ({
  skipEmailVerification,
  onChange,
}: EmailVerificationSettingProps) => (
  <div className="col-span-full space-y-3">
    <Label>Email verification</Label>
    <ChoiceCards
      value={skipEmailVerification ? "skip" : "require"}
      onChange={(mode) => onChange(mode === "skip")}
      options={EMAIL_VERIFICATION_OPTIONS}
      orientation="vertical"
      aria-label="Email verification"
    />
  </div>
);
