# Auto-deploy on image push: objective and findings

*Implementation-agnostic brief. It records what we are trying to achieve, what we learned, and what we proved. It deliberately does not prescribe the final design.*

## 1. Objective

When CI pushes a new container image to our registry, the corresponding stack on our server should pick up the new image and redeploy **automatically and within seconds**, with no manual step.

This replaces the old setup, where a self-hosted runner on the server finished its pipeline by running `docker compose up`. CI now runs on GitHub-hosted runners and only pushes images to `registry.yeg.casa`, so nothing currently tells the server to update.

### What the solution must do

- Trigger on a new image arriving in the registry (or on CI completing a push).
- Pull the new image and recreate the affected container(s).
- **Preserve each stack's environment** (variables, `env_file`, interpolated values).
- **Leave Portainer's own state intact**, so stacks remain normal, editable Portainer stacks.
- Avoid exposing the Portainer UI/API to the public internet if possible.

### Non-goals / constraints

- Stay on **Portainer Community Edition** (no move to Business Edition).
- No requirement to introduce a new orchestrator.

## 2. Environment

| Item | Value |
| --- | --- |
| Registry | zot at `registry.yeg.casa` |
| Orchestration UI | Portainer CE, reachable at `https://localhost:9443` from the server (self-signed cert) |
| Docker environment | Standalone Docker, Portainer endpoint Id `3` (`rac-env`) |
| Stack type | All current stacks are **web-editor** compose stacks (not Git-based) |
| Existing stacks | `uptime-kuma` (1), `ntfy` (12), `ddns` (13), `pantonify` (14); throwaway test stack `deploytest` (18) |
| Server architecture | linux/amd64 (images built on Apple Silicon are arm64 and fail to pull; use `--platform linux/amd64`) |
| CI | GitHub-hosted runners (amd64), push to the registry only |

## 3. Research findings

### Portainer

- **Stack and container webhooks are Business Edition only** (Portainer's official docs). Swarm *service* webhooks are the only webhook type available outside BE, and they do not apply to standalone Docker stacks. Several third-party blog posts blur or contradict this, so the official docs are the reference.
- Portainer CE has a **REST API** with **access tokens** (My account → Access tokens, sent as `X-API-Key`).
- For web-editor stacks, Portainer generates a `stack.env` file from the stack's environment-variable list at deploy time; `env_file: - stack.env` in the compose file reads it.
- Git-based stacks have a separate redeploy endpoint (`/api/stacks/{id}/git/redeploy`). Not relevant to our current stacks and not tested.

### zot (registry)

- zot has an **events extension** that can POST CloudEvents-style notifications to an HTTP endpoint (also NATS). It supports custom headers and credentials on the sink, and the event type is exposed in the `ce-type` header. The configuration can be hot-reloaded.
- Exact event type names for "image pushed" and the full payload shape have **not been observed yet**.

### Watchers and alternatives surveyed

- **Watchtower**: original project was archived in December 2025; forks exist but were not vetted. Polling-based, so slower than push-triggered.
- **Komodo**: free, open-source, Portainer-like tool with webhook-driven stack redeploys; a full replacement rather than an add-on.
- **Generic webhook listeners / SSH deploys / Tailscale from CI**: all viable in principle; each has different exposure and permission trade-offs.
- Triggering from CI requires the GitHub runner to reach the server (public endpoint or a tunnel such as Tailscale). Triggering from the registry does not.

## 4. What we proved by testing

All tests ran against a throwaway stack (`deploytest`, Id 18).

1. **Auth and discovery work.** An access token can list environments and stacks; the target stacks are web-editor type.
2. **The compose file can be read back** via the API.
3. **A stack update via the API with image re-pull really pulls and recreates.** After pushing a changed image and sending the update, the running container's image ID changed.
4. **Environment is preserved, for both `env_file` and `environment`.** The test compose used `env_file: - stack.env` plus an `environment:` block (one interpolated `${FOO}`, one literal). After the API redeploy to a new image, all variables survived, including ones that could only come through `env_file`, and Portainer's stored environment list was unchanged.

## 5. Reference: Portainer API calls that worked

```bash
export P=https://localhost:9443
H="X-API-Key: $K"     # access token; keep secret

# environments and stacks
curl -sk -H "$H" $P/api/endpoints | jq '.[] | {Id, Name, Type}'
curl -sk -H "$H" $P/api/stacks    | jq '.[] | {Id, Name, EndpointId, Status, Type, Env}'

# one stack, and its compose file
curl -sk -H "$H" $P/api/stacks/$SID
curl -sk -H "$H" $P/api/stacks/$SID/file | jq -r .StackFileContent

# redeploy with image re-pull, preserving env
STACK=$(curl -sk -H "$H" $P/api/stacks/$SID)
FILE=$(curl -sk -H "$H" $P/api/stacks/$SID/file | jq -r .StackFileContent)
curl -sk -X PUT -H "$H" -H "Content-Type: application/json" \
  "$P/api/stacks/$SID?endpointId=$EID" \
  -d "$(jq -n --arg f "$FILE" --argjson e "$(echo "$STACK" | jq '.Env // []')" \
        '{stackFileContent:$f, env:$e, prune:false, pullImage:true}')"
```

Notes on the redeploy call:

- Response on success: `{"Id":..,"Name":..,"Status":1}`.
- The stack's existing `env` array (`[{"name":"FOO","value":"bar"}, ...]`) must be sent back; the working assumption is that omitting it clears variables (not observed, see below).
- Field names (`pullImage`, `env`, `stackFileContent`, `prune`) were validated empirically on this Portainer version, not from official documentation, so re-test after upgrades.

### zot events configuration (shape, from zot docs)

```json
"extensions": {
  "events": {
    "enable": true,
    "sinks": [{
      "type": "http",
      "address": "<endpoint>",
      "timeout": "5s",
      "headers": { "X-Custom-Header": "<value>" }
    }]
  }
}
```

## 6. Not yet verified

- The **zot event payload**: event type for a push, how the repository name and tag appear, and how many events fire per push.
- **Negative control**: that omitting `env` actually wipes variables (assumed, not observed).
- Behaviour on **multi-service stacks** and on the real stacks, especially `ntfy`, which has eight environment variables.
- That stacks remain fully normal and editable in the Portainer UI after repeated API redeploys (quick manual check outstanding).
- Failure behaviour: what happens if the pull fails, the registry is unreachable, or Portainer is down mid-update.
- Tag strategy: testing used `:latest`. Pinned or SHA tags would need the image reference to come from a stack environment variable.

## 7. Open questions for the implementer

- **Where does the trigger originate**: the registry (zot events), CI, or a poller? This decides what is exposed and what runs where.
- **Where does the redeploy logic live**: calling Portainer's API (state stays in Portainer, proven above), or acting on Docker directly (not tested; risk of drifting from Portainer's stored definition)?
- **TLS**: Portainer's port 9443 is self-signed. Is the plain HTTP port 9000 enabled for internal use?
- **Idempotence**: registries can emit several events per push; the design needs to tolerate duplicates.
- **Visibility**: how should failures surface (for example, via the existing `ntfy` instance)?
- **Rollback**: `:latest` offers none; decide whether SHA tags are wanted.

## 8. Housekeeping and notes

- An API access token was pasted in plain text during testing. **Revoke it**, and use a dedicated low-privilege Portainer user for any automation token.
- Several stacks set `TZ=AMERICA/EDMONTON`. Timezone names are case-sensitive on Linux; the correct value is `America/Edmonton`.
- Sources caveat: Portainer API details came partly from blog posts of mixed quality. Where this brief states something as verified, it was observed in our own testing.
