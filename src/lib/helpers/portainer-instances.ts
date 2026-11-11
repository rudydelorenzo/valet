import type { PortainerInstance } from "@/lib/db/schema";
import type { Instance } from "@/types";

/**
 * Whitelist projection that strips the access token and serializes the
 * instance into its application shape (see ./types) before it is returned
 * over the API. Compile-checked: when the schema gains a column, this
 * must be updated or the build fails.
 */
export const toPublicInstance = (instance: PortainerInstance): Instance => ({
  id: instance.id,
  name: instance.name,
  url: instance.url,
  insecureTls: instance.insecureTls,
  hasToken: Boolean(instance.token),
  createdAt: instance.createdAt.toISOString(),
});
