# Valet — Agent Guide

The project bible for agents: what Valet is, how it works inside, and the rules
for working on it. Read this before touching code. (UI/branding guidelines live
in a separate doc.)

## 1. What Valet is

Valet is a **self-hosted, single-container web app that gives Portainer CE
stacks CI-triggerable deploy hook URLs**.

**Why it exists:** Portainer CE has no stack or container webhooks. Without
Valet, re-pulling and re-deploying a stack from CI means the Portainer UI or
SSH. Valet closes the gap: each stack gets a secret-token deploy URL —
`POST https://valet.example.com/api/deploy/<token>` — and Valet drives
Portainer's *own* API to update the stack with an image re-pull. The stack
stays fully managed by Portainer; Valet is just the trigger layer.

**Design constraints, by choice:**

- **One container, one process.** SQLite (file on a volume) is the database,
  the event queue, and the cache. No external Postgres, Redis, or queue
  broker.
- **The worker is in-process.** A poll loop inside the Node server claims
  events from the DB and executes them. No sidecar.
- **BYO auth.** No local passwords. Sign-in is OIDC (Authorization Code +
  PKCE) against providers you configure (e.g. Authentik). The first account
  to sign in becomes the admin.
- **Self-hosted.** Images published to Docker Hub (`rdelorenzo/valet`) and
  GHCR (`ghcr.io/rudydelorenzo/valet`), multi-arch (`linux/amd64`,
  `linux/arm64`). Primary deployment target is a Portainer stack.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind 4 +
shadcn/ui, SQLite via Drizzle ORM + `better-sqlite3`, Zod validation, `jose`
JWTs, hand-rolled OIDC client. License: **GPL-3.0**.

## 2. How it works

### 2.1 The deploy path (the core feature)

```
CI                          Valet (this app)                    Portainer CE
 │  POST /api/deploy/<token>   │                                     │
 ├────────────────────────────►│ lookup webhook by token (URL = auth) │
 │                             │ pre-flight: instance + stack exist   │
 │                             │ INSERT webhook_events (status=queued)│
 │                             │ ensureWorker()                       │
 │◄── 200 {received, eventId,  │                                     │
 │        deployUrl, statusUrl, │                                     │
 │        eventUrl }            │                                     │
 │                             │ worker loop claims event (running)   │
 │                             │ GET /api/stacks/{id} + /file         │
 │                             ├─────────────────────────────────────►│
 │                             │ PUT /api/stacks/{id}?endpointId=     │
 │                             │   {StackFileContent, Env, Prune:     │
 │                             │    false, PullImage,                 │
 │                             │    RepullImageAndRedeploy}           │
 │                             ├─────────────────────────────────────►│
 │                             │ mark event success | error           │
 │  GET statusUrl (poll)       │                                     │
 ├────────────────────────────►│ 200 success / 202 queued|running /   │
 │                             │ 502 error / 404 not found            │
```

1. `POST /api/deploy/[token]` is the **CI-facing entry point** (route:
   `src/app/api/deploy/[token]/route.ts`). The secret token lives *in the URL
   path* — that's the entire authentication for these endpoints. No headers.
2. The route looks the token up (`getWebhookByToken`), 404s on unknown, 403s
   on disabled, then **pre-flights**: instance exists, stack still exists on
   Portainer (424 if not). Fail fast before queueing.
3. It inserts a `webhook_events` row (`status=queued`) and returns
   immediately with a `DeployReceipt`: `received`, `eventId`, `deployUrl`,
   `statusUrl`, `eventUrl`. CI polls `statusUrl`.
4. The **worker** (in-process, `src/lib/worker/`) claims the oldest queued
   event, marks it `running`, and dispatches to the handler registered for
   the event type — `deploy` → `consumeDeployEvent`
   (`src/lib/worker/jobs/deploy.ts`) → `redeployStack`
   (`src/lib/portainer.ts`): fetch the stack + its compose file, PUT them
   back with `PullImage: true` and `RepullImageAndRedeploy: true` (both are
   sent for old/new Portainer compatibility), preserving the stack's `Env`.
   Result → `success` or `error` + message.
5. Polling: `GET /api/deploy/[token]/status/[eventId]` maps event status to
   HTTP codes (`200` success, `202` queued/running, `502` error). With
   `Accept: text/plain` it returns the bare status word — that's what the
   CI snippets poll. `GET .../events/[eventId]` returns full event details.

The manual UI trigger (`POST /api/webhooks/[id]/trigger`) runs the deploy
synchronously in the request (auth required) and drains the queue afterward
— it's the "test it right now" button.

### 2.2 Auth & first-time setup

- **Sessions:** JWT (HS256 via `jose`), signed with `AUTH_SECRET` (throws in
  production if unset; dev fallback constant exists). 30-day expiry, stored
  in an httpOnly cookie (`valet.session`). Payload: `sub` (userId), `email`,
  `name`, `isAdmin`.
- **Middleware:** `src/proxy.ts` verifies the session cookie on every
  request. `PUBLIC_PREFIXES` lists the public paths (`/api/deploy/`,
  `/api/auth/`, `/api/setup`, `/api/healthz`, `/setup`, `/login`, `/_next/`,
  `/favicon`) — **new public endpoints must be added there** or they'll
  redirect to `/login`. `/admin` and `/api/admin` additionally require
  `isAdmin`.
- **OIDC:** hand-rolled client in `src/lib/auth/oidc.ts` (discovery, PKCE
  S256, code exchange, userinfo). Providers are DB rows
  (`oidc_providers`), configured in the admin UI. `user_oidc_links` maps
  `(providerId, sub)` → user; email becomes the user's identity.
- **First-time setup:** with no providers configured, the app shows a setup
  flow. The container prints a **setup code** to its logs on first use
  (in-memory, `src/lib/setup.ts`). Enter it to start a one-hour setup session
  and configure the first OIDC provider. **The first account to sign in
  becomes the admin.**
- **Route guards:** `requireAuth()` / `requireAdmin()`
  (`src/lib/auth/guard.ts`) throw `Response` 401/403 for API routes.

### 2.3 Data model

Six tables in `src/lib/db/schema.ts`, all with prefixed random IDs
(`usr_…`, `inst_…`, `whk_…`, `evt_…`, `prov_…`, `link_…`):

- `users` — email, name, `isAdmin`
- `user_oidc_links` — provider/sub ↔ user links
- `oidc_providers` — name, issuer, clientId, clientSecret, scopes,
  `skipEmailVerification`, enabled
- `portainer_instances` — name, url, token (X-API-Key), `insecureTls`
- `webhooks` — name, `token` (the URL secret, 32 random bytes base64url),
  instance + stackId + endpointId, enabled, `debounceSeconds`
- `webhook_events` — type, status (`queued` → `running` → `success|error`),
  message, `triggerSource` (`webhook`|`manual`), createdAt

Every user-scoped row carries `userId`; routes **must** verify ownership
(e.g. `webhook.userId !== userId` → 404) — the token-authenticated deploy
routes are the exception (token lookup is the auth).

Migrations: generated SQL lives in `drizzle/` and is **applied automatically
at startup** (`src/instrumentation.ts` → `runMigrations`). `healthz` verifies
the journal count against `__drizzle_migrations`, so never delete or reorder
applied migrations.

### 2.4 The worker

`src/lib/worker/index.ts` — a deliberately simple in-process loop:

- Polls the DB every 1s for the oldest `queued` event, claims it (status →
  `running`).
- Dispatches by event type to a registered handler (`Map<string,
  EventHandler>`). Handlers return `{ success, message }`.
- Sequential by design — no parallelism (roadmap item).
- **Idles out** after 30s with no work; every enqueue path calls
  `ensureWorker()` to wake it again.
- At startup it marks `running` events older than 10 minutes as `error`
  ("interrupted or timed out") — crash recovery.
- Handlers are registered in `instrumentation.ts` *before* `startWorker()`.
  New event types: write a handler in `src/lib/worker/jobs/`, register it
  there.

Known gap: `webhooks.debounceSeconds` is stored and exposed by the API but
**not yet enforced** by the worker.

### 2.5 Health, degradation, reachability

- **`GET /api/healthz`** (public) — readiness: `SELECT 1` + migration-journal
  count check. 200/503. The Docker HEALTHCHECK hits it. Uses
  `await connection()` to opt out of build-time prerendering.
- **Degradation** — a webhook's derived status is
  `active | disabled | degraded`: degraded when >30% of its events in the
  last 24h failed. Computed in `src/lib/db/webhooks.ts`
  (`getWebhookHealth`).
- **Reachability** — `GET /api/instances/reachability?ids=a,b` pings each
  Portainer's `/api/status` (3s timeout, parallel). The UI polls every 5s
  (`src/hooks/use-reachability.ts`).

### 2.6 API surface (map)

| Prefix | Auth | Purpose |
| --- | --- | --- |
| `/api/deploy/[token]` (+`/status/`, `/events/`) | token in URL | CI-facing deploy hooks |
| `/api/webhooks` (+`/[id]`, `/trigger`, `/events`) | session | CRUD + manual trigger |
| `/api/instances` (+`/[id]`, `/environments`, `/stacks`, `/environments/[envId]/stacks/[stackId]`, `/favicon`, `/reachability`) | session | Portainer instance management |
| `/api/admin/users`, `/api/admin/providers` | admin | user/provider admin |
| `/api/auth/*` | public | OIDC login/callback/logout/session |
| `/api/setup` | public (code) | first-time setup flow |
| `/api/events` | session | cross-webhook event feed (dashboard) |
| `/api/healthz` | public | readiness probe |

## 3. Code organization

```
src/
  app/                      # App Router: pages + colocated API route handlers
    admin/                  #   admin UI (users, settings)
    instances/ webhooks/ setup/ login/   # feature pages
    api/                    # all route handlers, mirroring the surface above
  components/
    ui/                     # shadcn/ui primitives (button, dialog, …)
    deploy-wizard/          # the multi-step "create hook" wizard
    deploy-integration/     # CI snippet dialog + mustache .md templates
    …                       # feature components
  hooks/                    # client data hooks (use-stacks, use-environments,
                            #   use-reachability)
  lib/                      # THE domain core (no UI)
    auth/                   #   guard, oidc, session, secret
    db/                     #   schema + one accessor module per table
    worker/ (+jobs/)        #   in-process event loop
    portainer.ts            #   Portainer REST client
    http.ts                 #   json()/parseBody() response gate
    ids.ts urls.ts webhook-urls.ts constants.ts setup.ts oidc-scopes.ts utils.ts
  proxy.ts                  # middleware: session gate + PUBLIC_PREFIXES
  instrumentation.ts        # startup: migrations + worker registration
  types/
    api.ts                  # endpoint contracts (Zod → inferred types)
    index.ts                # app shapes passed between routes and frontend
drizzle/                    # migration SQL + meta journal (auto-applied)
dev/deploy-test-image/      # throwaway image + push.sh for exercising hooks
docs/                       # deploy-hook-api.md, research notes, agent-guide.md
```

Layer boundaries that matter:

- **`src/lib` has no UI code.** Pages/components import from it, never the
  reverse.
- **The DB layer is sealed** — see the three laws below.
- **Types live with their boundary:** API contracts in `types/api.ts`,
  wire shapes in `types/index.ts`, row types in `db/schema.ts`, Portainer
  payload shapes in `lib/portainer.ts`.

## 4. Development guidelines

### 4.1 The three laws (ESLint-enforced, in `eslint.config.mjs`)

1. **The response gate.** Every JSON response goes through `json(schema, …)`
   from `src/lib/http.ts` — it serializes through the Zod schema, stripping
   unknown keys so secrets can never leak unless a schema declares them.
   Raw `NextResponse.json`/`Response.json` outside `lib/http.ts` is an
   eslint **error**. Same for request bodies: `parseBody(request, Schema)`.
2. **No lazy schemas.** `z.any`/`z.unknown`/`z.looseObject`/`passthrough`/
   `catchall` are banned — they defeat the allowlist. Model the exact shape.
3. **DB access only in `src/lib/db`.** Nothing outside may import the
   database handle, `schema.ts`, `drizzle-orm`, or `better-sqlite3` (type-only
   imports allowed). Route code uses accessor functions
   (`@/lib/db/webhooks`, etc.). Schema changes go through accessors.

The one sanctioned `eslint-disable` in the codebase is the gate itself in
`src/lib/http.ts`. Everything else should fix the code, not silence the
rule.

### 4.2 API route recipe

```ts
export const POST = async (request: Request, { params }: { params: Promise<…> }) => {
  const userId = await requireAuth();               // or requireAdmin
  const body = await parseBody(request, SomeSchema); // 400 on invalid
  if (body instanceof NextResponse) return body;
  // … ownership checks …
  const data = await someDbAccessor(userId, …);
  return json(SomeResponseSchema, data, { status: 201 });
};
```

- Schemas live in `src/types/api.ts` (endpoint contracts) or `index.ts`
  (app shapes). Types are **inferred** from Zod — don't hand-write
  interfaces that duplicate them.
- Errors: `json(ApiErrorSchema, { error: "…" }, { status: 4xx })`.
- In Next 16, `params` is a **Promise** — `await` it.

### 4.3 DB / migrations

- Schema edits → `drizzle-kit generate` → commit the SQL in `drizzle/`.
  Never hand-edit applied migrations (healthz depends on the journal
  matching).
- Migrations apply at startup (`instrumentation.ts`); the container ships
  `drizzle/` and runs them on boot.
- Add accessor functions to the per-table module in `src/lib/db/`; keep the
  sealed-layer law in mind.

### 4.4 Next.js 16 specifics that have bitten us

- **`params` is a Promise** in route handlers and pages — `await` it.
- **DB-reading GET routes crash `next build`'s prerender** against a fresh
  DB unless they call `await connection()` from `next/server` (see
  `healthz` and `auth/providers` routes).
- Read `node_modules/next/dist/docs/` before Next-specific work (the
  Next.js block in `AGENTS.md` says the same).
- `next.config.ts` quirks: `DOCKER_BUILD=1` gates the `standalone` output
  (Docker-only); `outputFileTracingIncludes` keeps the `better-sqlite3`
  native binding in the standalone trace — don't break either. Turbopack
  rules load `*.md` as raw text (the CI templates).

### 4.5 Environment

- **Node ≥ 24** (`engines`). `better-sqlite3` compiles against the Node
  ABI — running under an older Node produces `ERR_DLOPEN_FAILED` /
  `NODE_MODULE_VERSION` crashes at runtime. Lint/typecheck work on older
  Node, but `dev`/`build`/`start` need 24. CI and Docker use `node:24-slim`.
- Env vars (see `.env.example`): `DATABASE_URL` (default `./data/valet.db`),
  `APP_BASE_URL` (OIDC redirect base), `AUTH_SECRET` (required in prod).
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`
  (`next typegen && tsc --noEmit` — run both parts).

### 4.6 Quality bar

- **`npm run lint` reports 0 problems** — warnings get fixed, not
  suppressed or downgraded. Same for `npm run typecheck`.
- Fix the root cause: e.g. the `react-hooks/set-state-in-effect` warnings
  were resolved with render-time state adjustment (prev-prop guards), not
  `eslint-disable`.
- Prefer explicit `if/else` in route handlers over clever ternaries.
- No test suite yet — correctness today is enforced by lint, typecheck, and
  the schema gate. New tests would be welcome.

## 5. Watch out for

- **Never hardcode a personal registry** (e.g. `registry.yeg.casa`) as a
  default anywhere. `dev/deploy-test-image/push.sh` intentionally has no
  default `REGISTRY`.
- **README.md is user-curated** — keep changes minimal and additive; the
  Getting Started section reflects Portainer-first deployment.
- **CI Docker job only runs on pushes to `main`** (lint/typecheck/build run
  on all PRs). It needs repo secrets `DOCKERHUB_USERNAME` +
  `DOCKERHUB_TOKEN`; GHCR uses `GITHUB_TOKEN`. `provenance: false` in the
  build is intentional (avoids `unknown/unknown` attestation manifests in
  pull output). The README is synced to the Docker Hub description on every
  push to main.
- **`.dockerignore` excludes `dev/`, `docs/`, `.github/`** — changes there
  don't affect the image.
- **Public paths must be registered** in `PUBLIC_PREFIXES` (`src/proxy.ts`)
  or the middleware will redirect them to `/login`.
- **The deploy endpoints' only auth is the URL token** — treat webhook
  tokens as secrets (the wizard shows the URL on creation, and the webhook
  detail page displays it; CI stores it as a secret).
- `InstanceIcon` uses `next/image` **unoptimized** — favicons are proxied
  bytes of unknown size/format; the optimizer can't process them.
- Portainer client quirks (`src/lib/portainer.ts`): API fields are
  PascalCase; `insecureTls` swaps in a shared undici agent with
  `rejectUnauthorized: false`; a `409 already in progress` from Portainer is
  mapped to a friendly "try again shortly" error message.
- Startup applies migrations and starts the worker inside
  `instrumentation.ts` — anything DB- or worker-related that must exist at
  boot belongs there.

## 6. Where things live (quick reference)

| Task | Touch |
| --- | --- |
| Change the deploy behavior | `src/lib/worker/jobs/deploy.ts` + `src/lib/portainer.ts` |
| New event type / job | `src/lib/worker/jobs/` + register in `src/instrumentation.ts` |
| New endpoint | `src/app/api/…/route.ts` + schemas in `src/types/api.ts` |
| DB change | `src/lib/db/schema.ts` → `drizzle-kit generate` → accessor in `src/lib/db/` |
| Public route | add prefix to `PUBLIC_PREFIXES` in `src/proxy.ts` |
| Auth change | `src/lib/auth/` + `src/proxy.ts` |
| CI / image | `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, `next.config.ts` |
| User docs | `README.md` (careful — user-curated), `docs/deploy-hook-api.md` |
