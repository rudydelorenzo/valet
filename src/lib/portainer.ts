import { Agent, type Dispatcher } from "undici";

export interface PortainerStack {
  Id: number;
  Name: string;
  EndpointId: number;
  Status: number;
  Type: number;
  Env: Array<{ name: string; value: string }>;
}

function getDispatcher(insecureTls: boolean): Dispatcher | undefined {
  if (insecureTls) {
    return new Agent({ connect: { rejectUnauthorized: false } });
  }
  return undefined;
}

async function portainerFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  insecureTls: boolean,
  init?: RequestInit,
): Promise<T> {
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
    throw new Error(`Portainer API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Test that we can reach Portainer and list environments. */
export async function testConnection(
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<{ ok: boolean; message: string }> {
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
}

/** List stacks for a given environment. */
export async function listStacks(
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<PortainerStack[]> {
  return portainerFetch<PortainerStack[]>(baseUrl, token, "/api/stacks", insecureTls);
}

/**
 * Redeploy a stack with image re-pull, preserving its env.
 * This is the proven Portainer CE API call from the docs.
 */
export async function redeployStack(
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  stackId: number,
  endpointId: number,
): Promise<{ success: boolean; message: string }> {
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

    // Redeploy with pullImage: true, preserving env
    await portainerFetch<unknown>(
      baseUrl,
      token,
      `/api/stacks/${stackId}?endpointId=${endpointId}`,
      insecureTls,
      {
        method: "PUT",
        body: JSON.stringify({
          stackFileContent: fileResp.StackFileContent,
          env: stack.Env || [],
          prune: false,
          pullImage: true,
        }),
      },
    );

    return { success: true, message: `Stack "${stack.Name}" redeployed successfully` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}