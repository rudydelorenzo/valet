import { Agent, type Dispatcher } from "undici";

export interface PortainerStack {
  Id: number;
  Name: string;
  EndpointId: number;
  Status: number;
  Type: number;
  Env: Array<{ name: string; value: string }>;
}

// Shared undici agent — reused across requests to avoid per-request TLS handshakes.
let _insecureAgent: Agent | undefined;
const getDispatcher = (insecureTls: boolean): Dispatcher | undefined => {
  if (!insecureTls) return undefined;
  if (!_insecureAgent) {
    _insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
  }
  return _insecureAgent;
};

const portainerFetch = async <T>(
  baseUrl: string,
  token: string,
  path: string,
  insecureTls: boolean,
  init?: RequestInit,
): Promise<T> => {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await globalThis.fetch(url, {
    ...init,
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
    ...(getDispatcher(insecureTls) ? { dispatcher: getDispatcher(insecureTls) } : {}),
  } as Parameters<typeof globalThis.fetch>[1]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Truncate long error bodies (e.g. HTML error pages)
    const truncated = body.length > 500 ? body.slice(0, 500) + "…" : body;
    throw new Error(`Portainer API ${res.status}: ${truncated}`);
  }
  return res.json() as Promise<T>;
};

/** Test that we can reach Portainer and list environments. */
export const testConnection = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<{ ok: boolean; message: string }> => {
  try {
    const endpoints = await portainerFetch<Array<{ Id: number; Name: string }>>(
      baseUrl,
      token,
      "/api/endpoints",
      insecureTls,
    );
    return { ok: true, message: `Connected — ${endpoints.length} environment(s) found` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
};

/** List stacks for a given environment. */
export const listStacks = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<PortainerStack[]> => {
  return portainerFetch<PortainerStack[]>(baseUrl, token, "/api/stacks", insecureTls);
};

/**
 * Redeploy a stack with image re-pull, preserving its env.
 *
 * Uses the Portainer CE stack update API (PUT /api/stacks/{id}).
 * Field names use PascalCase per the official API docs.
 * `RepullImageAndRedeploy` replaces the deprecated `PullImage` (2.36+).
 * Both are sent for backward compatibility with older Portainer versions.
 */
export const redeployStack = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  stackId: number,
  endpointId: number,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Fetch the current stack and its compose file
    const [stack, fileResp] = await Promise.all([
      portainerFetch<PortainerStack>(baseUrl, token, `/api/stacks/${stackId}`, insecureTls),
      portainerFetch<{ StackFileContent: string }>(
        baseUrl,
        token,
        `/api/stacks/${stackId}/file`,
        insecureTls,
      ),
    ]);

    // Redeploy with image re-pull, preserving env.
    // Use the stack's own EndpointId for correctness (it may have changed).
    const eid = stack.EndpointId || endpointId;

    await portainerFetch<unknown>(
      baseUrl,
      token,
      `/api/stacks/${stackId}?endpointId=${eid}`,
      insecureTls,
      {
        method: "PUT",
        body: JSON.stringify({
          StackFileContent: fileResp.StackFileContent,
          Env: stack.Env || [],
          Prune: false,
          PullImage: true,
          RepullImageAndRedeploy: true,
        }),
      },
    );

    return { success: true, message: `Stack "${stack.Name}" redeployed successfully` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Portainer returns 409 when a deployment is already in progress
    if (msg.includes("409") && msg.includes("already in progress")) {
      return {
        success: false,
        message: "Stack deployment is already in progress — try again shortly",
      };
    }

    return { success: false, message: msg };
  }
};