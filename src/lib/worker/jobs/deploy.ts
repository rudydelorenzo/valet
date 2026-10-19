import { getWebhook } from "@/lib/db/webhooks";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { redeployStack } from "@/lib/portainer";
import { EventHandler } from "@/lib/worker";

/**
 * Run a deploy for a webhook and return the result.
 * Pure job logic — no side effects beyond the Portainer API call.
 */
export const consumeDeployEvent: EventHandler = async (
  event,
) => {
  try {
    const webhook = await getWebhook(event.webhookId);

    if (!webhook) return { success: false, message: "Webhook not found" };
    if (!webhook.enabled) return { success: false, message: "Webhook is disabled" };

    const instance = await getPortainerInstance(webhook.portainerInstanceId);

    if (!instance) return { success: false, message: "Portainer instance not found" };

    return await redeployStack(
      instance.url,
      instance.token,
      instance.insecureTls,
      webhook.stackId,
      webhook.endpointId,
    );
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
};