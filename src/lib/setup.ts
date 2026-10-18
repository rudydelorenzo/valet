/**
 * Initial-setup code — generated once per server lifetime,
 * printed to the console when the /api/setup endpoint is first hit.
 */

import { SETUP_CODE_LENGTH } from "./constants";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let setupCode: string | null = null;

const generateCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(SETUP_CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
};

/** Generate (if needed) and return the setup code. Prints to console once. */
export const getOrGenerateSetupCode = (): string => {
  if (!setupCode) {
    setupCode = generateCode();
    console.log();
    console.log("══════════════════════════════════════════════");
    console.log("  Valet — Initial setup required");
    console.log();
    console.log(`  Setup code: ${setupCode}`);
    console.log();
    console.log("  Enter this code in the app to configure");
    console.log("  your first login provider.");
    console.log("══════════════════════════════════════════════");
    console.log();
  }
  return setupCode;
};

/** Verify a user-supplied code (case-insensitive, trimmed). */
export const verifySetupCode = (input: string): boolean => {
  if (!setupCode) return false;
  return input.trim().toUpperCase() === setupCode;
};