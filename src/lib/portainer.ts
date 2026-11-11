import { Agent, type Dispatcher } from "undici";
import type { DeploymentJournalType } from "@/types";

export interface PortainerStack {
  Id: number;
  Name: string;
  EndpointId: number;
  Status: number;
  Type: number;
  Env: Array<{ name: string; value: string }>;
  /** Unix seconds — 0 when the stack was never updated (valid pre-PUT baseline). */
  UpdateDate: number;
  /** Unix seconds — 0 when unknown. */
  CreationDate: number;
  /**
   * Deployment journal — only exists on newer Portainer (>=2.41).
   * See DeploymentJournalType in @/types.
   */
  DeploymentStatus: DeploymentJournalType | null;
}

/**
 * A non-2xx from the Portainer API. Carries the status code so callers
 * map semantics (409 = deploy in progress, …) without string-matching
 * the message body.
 */
export class PortainerError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Portainer API ${status}: ${detail}`);
    this.name = "PortainerError";
  }
}

export interface DockerContainerSummary {
  Id: string;
  /** Unix seconds — the container object's creation time (Docker's clock). */
  Created: number;
  ImageID?: string;
  Labels?: Record<string, string> | null;
  State?: string;
}

export interface PortainerEnvironment {
  Id: number;
  Name: string;
  Type: number;
  URL: string;
  Status: number;
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
  timeoutMs = 60_000,
): Promise<T> => {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await globalThis.fetch(url, {
    ...init,
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
    // A hung request would otherwise wedge the single-threaded worker
    // loop forever; time out by default. Callers may pass their own
    // signal (pingInstance does) or a longer budget (the redeploy PUT).
    ...(init?.signal ? {} : { signal: AbortSignal.timeout(timeoutMs) }),
    ...(getDispatcher(insecureTls) ? { dispatcher: getDispatcher(insecureTls) } : {}),
  } as Parameters<typeof globalThis.fetch>[1]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Truncate long error bodies (e.g. HTML error pages)
    const truncated = body.length > 500 ? body.slice(0, 500) + "…" : body;
    throw new PortainerError(res.status, truncated);
  }
  return res.json() as Promise<T>;
};

/**
 * The API omits timestamps on never-updated stacks — normalize to their
 * documented "never" value (0) at the boundary so no caller deals with
 * undefined. Absent journals become null the same way.
 */
const normalizeStack = (stack: PortainerStack): PortainerStack => ({
  ...stack,
  UpdateDate: stack.UpdateDate ?? 0,
  CreationDate: stack.CreationDate ?? 0,
  DeploymentStatus: stack.DeploymentStatus ?? null,
});

/** Lightweight health check — pings /api/status and returns version if reachable. */
export const pingInstance = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<{ reachable: boolean; version?: string }> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const url = `${baseUrl.replace(/\/$/, "")}/api/status`;
    const res = await globalThis.fetch(url, {
      signal: controller.signal,
      headers: { "X-API-Key": token },
      ...(getDispatcher(insecureTls)
        ? { dispatcher: getDispatcher(insecureTls) }
        : {}),
    } as Parameters<typeof globalThis.fetch>[1]);

    clearTimeout(timeout);

    if (!res.ok) return { reachable: false };

    const data = (await res.json()) as { Version?: string };
    return { reachable: true, version: data.Version };
  } catch {
    return { reachable: false };
  }
};

/**
 * Validate that a URL points to a Portainer instance and the token works.
 * Returns { ok: true, version } on success, or { ok: false, error } on failure.
 */
export const validateInstance = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<{ ok: true; version?: string } | { ok: false; error: string }> => {
  // 1. Verify the URL points to Portainer
  const ping = await pingInstance(baseUrl, token, insecureTls);
  if (!ping.reachable) {
    return { ok: false, error: "Could not find a Portainer instance at this URL" };
  }

  // 2. Verify the token has access
  const test = await testConnection(baseUrl, token, insecureTls);
  if (!test.ok) {
    return { ok: false, error: test.message };
  }

  return { ok: true, version: ping.version };
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
  const stacks = await portainerFetch<PortainerStack[]>(baseUrl, token, "/api/stacks", insecureTls);
  return stacks.map(normalizeStack);
};

/** Fetch a single stack by ID. Returns null if not found. */
export const getStack = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  stackId: number,
  endpointId: number,
): Promise<PortainerStack | null> => {
  try {
    return normalizeStack(
      await portainerFetch<PortainerStack>(
        baseUrl,
        token,
        `/api/stacks/${stackId}?endpointId=${endpointId}`,
        insecureTls,
      ),
    );
  } catch (err) {
    if (err instanceof PortainerError && err.status === 404) return null;
    throw err;
  }
};

/** List environments (endpoints) registered in this Portainer instance. */
export const listEnvironments = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
): Promise<PortainerEnvironment[]> => {
  return portainerFetch<PortainerEnvironment[]>(baseUrl, token, "/api/endpoints", insecureTls);
};

/** Fetch a stack's compose file content. */
export const getStackFile = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  stackId: number,
): Promise<{ StackFileContent: string }> => {
  return portainerFetch<{ StackFileContent: string }>(
    baseUrl,
    token,
    `/api/stacks/${stackId}/file`,
    insecureTls,
  );
};

/**
 * PUT the stack back with the given compose + env, forcing an image
 * re-pull and redeploy. The response body is deliberately ignored: the
 * redeploy's outcome is confirmed (or refuted) by the evidence ladder,
 * never by trusting the PUT's 200 — keeping the machine version-agnostic.
 *
 * The deploy job composes this itself instead of calling a monolithic
 * "redeploy" helper: it must record the state-machine steps (and the
 * pre-PUT snapshot) before and after this call.
 */
export const updateStack = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  stackId: number,
  endpointId: number,
  body: { stackFileContent: string; env: Array<{ name: string; value: string }> },
): Promise<void> => {
  // Field names use PascalCase per the official API docs.
  // `RepullImageAndRedeploy` replaces the deprecated `PullImage` (2.36+).
  // Both are sent for backward compatibility with older Portainer versions.
  // Generous budget: pulls can take minutes; the event deadline is the
  // real cap, and a timeout here falls into the recovery watch path.
  await portainerFetch<PortainerStack>(
    baseUrl,
    token,
    `/api/stacks/${stackId}?endpointId=${endpointId}`,
    insecureTls,
    {
      method: "PUT",
      body: JSON.stringify({
        StackFileContent: body.stackFileContent,
        Env: body.env,
        Prune: false,
        PullImage: true,
        RepullImageAndRedeploy: true,
      }),
    },
    10 * 60_000,
  );
};

/**
 * List an endpoint's containers via Portainer's Docker Engine proxy
 * (`/endpoints/{id}/docker/*`), filtered to this stack. A redeploy
 * recreates changed services — new container objects with new Ids —
 * which is the evidence recovery uses to prove the redeploy happened.
 *
 * Returns [] on any failure: the evidence ladder treats "no data" as
 * "rung unavailable", never as a reason to fail the deploy.
 */
export const getStackContainers = async (
  baseUrl: string,
  token: string,
  insecureTls: boolean,
  endpointId: number,
  stackName: string,
): Promise<DockerContainerSummary[]> => {
  try {
    const all = await portainerFetch<DockerContainerSummary[]>(
      baseUrl,
      token,
      `/api/endpoints/${endpointId}/docker/containers/json?all=1`,
      insecureTls,
    );
    if (!Array.isArray(all)) return [];
    const name = stackName.toLowerCase();
    return all.filter((c) => {
      // Compose stacks label containers with the project name; Docker
      // lowercases it, so compare case-insensitively. Swarm stacks use
      // the namespace label instead.
      const project = c.Labels?.["com.docker.compose.project"];
      const namespace = c.Labels?.["com.docker.stack.namespace"];
      return (
        (typeof project === "string" && project.toLowerCase() === name) ||
        (typeof namespace === "string" && namespace.toLowerCase() === name)
      );
    });
  } catch {
    return [];
  }
};