# Valet

**Programmatically trigger stack redeploys for Portainer.**

Push a new image from CI, hit a webhook, and your Portainer stack is pulling and redeploying within seconds.

[![CI](https://github.com/rudydelorenzo/valet/actions/workflows/ci.yml/badge.svg)](https://github.com/rudydelorenzo/valet/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-rdelorenzo%2Fvalet-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/rdelorenzo/valet)
[![Docker Pulls](https://img.shields.io/docker/pulls/rdelorenzo/valet)](https://hub.docker.com/r/rdelorenzo/valet)
[![Docker Image Size](https://img.shields.io/docker/image-size/rdelorenzo/valet/latest)](https://hub.docker.com/r/rdelorenzo/valet)
[![Node.js](https://img.shields.io/badge/node-%3E%3D%2024-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## Why Valet?

Portainer CE has no stack or container webhooks. This means that if you want to re-pull and re-deploy a stack as part of CI, you can't. You have to go into the UI or SSH.

Valet closes that gap. Each stack gets a **deploy hook URL**. When you want to re-deploy your stack, simply POST to that hook and Valet asks Portainer — via its own API — to update the stack with an image re-pull.

The stack will re-deploy and re-pull, using the same compose file and environment variables. Stack environment (`environment`, `env_file`, interpolated values) survives intact, and stacks remain completely normal and editable in the Portainer UI. Nothing acts on Docker behind Portainer's back.

## Features

- **Deploy hooks per stack** — a secret-token URL for each stack you want CI to deploy
- **UI for management** - you can manage users, portainer instances, and webhooks from an easy-to-use web UI.
- **Zero-drift redeploys** — uses Portainer's own API, keeping the stack fully managed by Portainer
- **Webhook degradation alerting** — we check stack reachability in the background, so if something breaks you'll know about it before a deploy failure
- **Multi-instance** — manage several Portainer servers (each with its own access token) with reachability and version checks
- **CI-ready** — copy-paste snippets for GitHub Actions, CircleCI, and other CI providers, generated for your exact hook
- **OIDC login** — multi-provider OpenID Connect with PKCE
- **Super simple to deploy** — valet is a single container, so you don't have to worry about external queues, databases, or caches.

## How it works

```mermaid
sequenceDiagram
    participant CI as CI pipeline
    participant V as Valet
    participant Q as SQLite queue
    participant W as Worker
    participant P as Portainer CE API

    CI->>V: POST /api/deploy/{token}
    V->>Q: Enqueue deploy event
    V-->>CI: 200 { eventId, statusUrl }
    W->>Q: Claim event (poll)
    W->>P: GET /api/stacks/{id} + /file
    W->>P: PUT /api/stacks/{id}?endpointId=…<br/>compose + env sent back, pullImage: true
    P->>P: Pull image, recreate containers
    W->>Q: Mark event success/error
    CI->>V: GET statusUrl (poll until done)
    V-->>CI: queued → running → success
```

## Screenshots

<!-- Drop screenshots into docs/images/ and uncomment. -->

<!-- ![Dashboard](docs/images/dashboard.png)
![Webhook detail](docs/images/webhook-detail.png)
![Setup wizard](docs/images/setup-wizard.png) -->

*Screenshots coming soon — placeholders live in [`docs/images/`](docs/images/).*

## Getting Started

### Prerequisites

- An environment to deploy Valet into, this can be either plain docker + compose or even Portainer itself.

### 1. Deploy

If you're already running Portainer, you can deploy Valet as just another stack on it:

1. In Portainer, go to **Stacks → Add stack** and name it `valet`.
2. You can use this compose definition as a starting point:

   ```yaml
   services:
     valet:
       image: rdelorenzo/valet:latest
       restart: unless-stopped
       ports:
         - "3000:3000"
       environment:
         APP_BASE_URL: https://valet.example.com
         AUTH_SECRET: <your-secret-here>
       volumes:
         - valet-data:/app/data

   volumes:
     valet-data:
   ```
> [!TIP] 
> A ready-made sample lives at [`docker-compose.yml`](docker-compose.yml) in the repo root.

3. Set the environment variables — either inline above, or under the stack's **Environment variables** section (Portainer keeps those with the stack):
   - `APP_BASE_URL` — your public URL, will be used to compute hook and auth URLs
   - `AUTH_SECRET` — generate one with

     ```bash
     openssl rand -base64 32
     ```

4. **Deploy the stack.**

Notes:

Valet talks to Portainer over its API as a client. Deployed on the same host as Portainer, `host.docker.internal` or a shared network works; for self-signed certs (e.g. Portainer's `:9443`), enable the instance's *insecure TLS* option when adding it.

### 2. First-time setup

1. Open the app in a browser. With no login provider configured, it'll send you to the first-time setup flow.
2. Grab the **setup code** from the container logs — it's printed there on first use (in Portainer: **Containers → valet → Logs**, or `docker logs valet`):

   ```text
   ══════════════════════════════════════════
     Valet — Initial setup required
     Setup code: A1B2C3
   ══════════════════════════════════════════
   ```

3. Enter the code (it's valid for one hour) and configure your first **OIDC auth provider**, for example Authentik. The flow will provide you with instructions.
4. Sign in through that provider. **The first account to sign in becomes the admin.**
5. As admin, add your Portainer instances under **Instances**, then create your first deploy hook (below).

## Usage

### Create a deploy hook

From the dashboard, **Create deployment hook** and walk through the wizard:

1. Pick a **Portainer instance** (or add one with the URL + access token)
2. Pick the **stack** to deploy
3. Name the hook

Each hook gets its own secret URL:

```url
https://valet.example.com/api/deploy/<token>
```

### Wire it into CI

Trigger the hook after your image push, then poll until the deploy finishes. We provide snippets to do this in the most popular CI frameworks.

Store the hook URL as a repository secret (e.g. `DEPLOY_WEBHOOK_URL`) rather than committing it.

Building a custom integration? See the [deploy hook API reference](docs/deploy-hook-api.md).

## Development

Run from source:

```bash
git clone https://github.com/rudydelorenzo/valet.git
cd valet
npm ci
npm run dev        # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types + TypeScript check |

Notes for contributors:

- Requires **Node.js ≥ 24**.
- Database migrations apply automatically at startup; generated SQL lives in [`drizzle/`](drizzle/).
- The SQLite database is created at `./data/valet.db` on first run (gitignored).

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/awesome`
3. Commit your changes: `git commit -m 'feat: add awesome'`
4. Push the branch: `git push origin feature/awesome`
5. Open a Pull Request

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev) |
| UI | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Base UI primitives) |
| Database | SQLite via [Drizzle ORM](https://orm.drizzle.team) + `better-sqlite3` (migrations auto-apply at startup) |
| Auth | [OpenID Connect](https://openid.net/developers/how-connect-works/) with PKCE; sessions are signed JWTs ([jose](https://github.com/panva/jose)) |
| Validation | [Zod](https://zod.dev) — the API contract, types inferred from schemas |
| Orchestration | [Portainer CE](https://www.portainer.io) REST API (`X-API-Key` access tokens) |

## License

Copyright (C) 2026 rudydelorenzo

Distributed under the GNU General Public License v3.0 (copyleft — derivative works must remain GPL). See [LICENSE](LICENSE) for details.

Questions or issues? Open a [GitHub issue](https://github.com/rudydelorenzo/valet/issues).

## Roadmap
- [ ] Scheduled stack healthckecks with worker
- [ ] Prebuilt GitHub Actions job to automate the redeploy + wait step.
- [ ] More integration guides for other CI frameworks
- [ ] Ability to self-deploy, this needs some thought given to it... my instinct is the deploy would start and 
execute successfully, but then immediately after triggering we'd shut down and lose track of progress. Maybe the 
fix here is writing event lifecycle events to the db and adding some write-flushing to the shutdown logic to ensure it writes
- [ ] Worker paralleization (sequential right now, if we were to paralellize we have to give some thought to ensuring 
we don't execute events for the same webhook in parallel)
- [ ] Better docs LOL, both about usage and about self-hosting