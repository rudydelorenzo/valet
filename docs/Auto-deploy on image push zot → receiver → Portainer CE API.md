# Auto-deploy on image push: zot → receiver → Portainer CE API

*Implementation brief. Status: core mechanism verified on a test stack; zot event wiring and receiver deployment still to do.*

## 1. Goal

When CI pushes a new image to `registry.yeg.casa` (zot), the matching Portainer stack on the server should pull it and redeploy within seconds, with no manual step. This replaces the old self-hosted-runner step that ran `docker compose up`.

## 2. Decision

**zot events extension → small receiver container → Portainer CE REST API (stack update with image re-pull).**

Why this shape:

- Portainer **stack/container webhooks are Business Edition only** (confirmed in Portainer's official docs). We are on CE and do not want to switch.
- Having the receiver call Portainer's own API means **Portainer performs the pull and recreate itself**, using its stored compose file and env vars. Its state tracking stays consistent; nothing drifts.
- zot and the receiver sit on an internal Docker network, so **nothing needs to be exposed to the internet** and GitHub Actions only has to `docker push`.

### Options considered and rejected

| Option | Why not |
| --- | --- |
| Portainer BE stack webhook | Paid edition (free node tier exists, but we want to stay on CE) |
| Watchtower | Original project archived Dec 2025; forks are unvetted; polling is slower |
| Receiver runs `docker compose` directly | Portainer keeps web-editor stack files and env vars in its own volume/DB; external runs can drift from its stored definition |
| GitHub Actions calling Portainer | Requires exposing Portainer (or Tailscale) to GitHub runners |
| Komodo | Free and capable, but a full replacement for Portainer; larger change |

## 3. Environment facts (from our testing)

- Portainer CE, reachable on `https://localhost:9443` from the server (self-signed cert).
- Docker environment: **endpoint Id `3`** (`rac-env`, Type 1 = standalone Docker).
- Stacks (all **web-editor**, `GitConfig: false`, Type 2 = compose): `uptime-kuma` (1), `ntfy` (12), `ddns` (13), `pantonify` (14). Throwaway test stack: `deploytest` (18).
- Server architecture is **linux/amd64**. Images built on an Apple Silicon Mac are arm64 and fail with *no matching manifest for linux/amd64*. Use `docker buildx build --platform linux/amd64 ... --push` for any manual test pushes. GitHub's standard runners are amd64, so CI is unaffected.
- Registry is **zot**, which has an events extension (HTTP sink).

## 4. Verified Portainer API behaviour

Auth: access token (My account → Access tokens), sent as `X-API-Key: <token>`.

```bash
export P=https://localhost:9443
H="X-API-Key: $K"   # $K = access token; never commit or paste it
```

| Purpose | Call | Verified |
| --- | --- | --- |
| List environments | `GET /api/endpoints` | Yes |
| List stacks (Id, Env, GitConfig) | `GET /api/stacks` | Yes |
| Get one stack (incl. `Env`) | `GET /api/stacks/{id}` | Yes |
| Read compose YAML | `GET /api/stacks/{id}/file` → `.StackFileContent` | Yes |
| Redeploy with re-pull | `PUT /api/stacks/{id}?endpointId={eid}` | Yes |

The redeploy payload that worked:

```bash
STACK=$(curl -sk -H "$H" $P/api/stacks/$SID)
FILE=$(curl -sk -H "$H" $P/api/stacks/$SID/file | jq -r .StackFileContent)
curl -sk -X PUT -H "$H" -H "Content-Type: application/json" \
  "$P/api/stacks/$SID?endpointId=$EID" \
  -d "$(jq -n --arg f "$FILE" --argjson e "$(echo "$STACK" | jq '.Env // []')" \
        '{stackFileContent:$f, env:$e, prune:false, pullImage:true}')"
```

It returns `{"Id":..,"Name":..,"Status":1}`.

**Critical:** always send the stack's existing `env` array back. The Env shape is `[{"name":"FOO","value":"bar"}, ...]`.

## 5. Tests completed

All on throwaway stack `deploytest` (Id 18):

1. **Auth and discovery** worked; stack is web-editor type.
2. **Read compose file** via API worked.
3. **Redeploy pulls a new image:** pushed a changed amd64 image, ran the PUT, and the running container's image ID changed (before ≠ after).
4. **Env preservation, both mechanisms:** compose used `env_file: - stack.env` plus `environment:` (one interpolated `${FOO}`, one literal). Stack env vars `FOO`, `TZ`, `FROMFILE` were set in the UI. After the API redeploy to a new image, the container still had all of `FOO`, `TZ`, `FROMFILE` (env\_file path), `EXPLICIT` (interpolation) and `LITERAL`, and Portainer's stored `Env` was unchanged.

### Not yet verified

- Negative control: that omitting `env` (sending `[]`) wipes variables. Assumed, not observed. The receiver always sends `env`, so this should not matter.
- UI check that stack 18 still looks like a normal, editable stack after API redeploys.
- Multi-service stacks and the real stacks (especially `ntfy`, which has 8 env vars).
- **The zot event payload and event type names**: not yet seen with real data.

## 6. zot events configuration

Add to zot's config (hot-reloadable per the zot docs):

```json
"extensions": {
  "events": {
    "enable": true,
    "sinks": [{
      "type": "http",
      "address": "http://deployer:8080/zot",
      "timeout": "5s",
      "headers": { "X-Deploy-Token": "<long-random-secret>" }
    }]
  }
}
```

Events are CloudEvents; for HTTP sinks the event type is in the `ce-type` header. Payloads include the repository name and media type. **First run the receiver in log-only mode**, push a test image, and record the real `ce-type` and body before tightening the filter. Expect multiple events per push (per manifest/tag), hence the debounce.

## 7. Receiver

Standard-library Python, no dependencies. Config via env vars: `PORTAINER_URL`, `PORTAINER_TOKEN`, `DEPLOY_SECRET`, `TARGETS` (JSON map of repo name → `[stack_id, endpoint_id]`), optional `DEBOUNCE_SECONDS`, `INSECURE_TLS=1`.

```python
import hmac, json, os, ssl, threading, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

P = os.environ["PORTAINER_URL"]
KEY = os.environ["PORTAINER_TOKEN"]
SECRET = os.environ["DEPLOY_SECRET"]
TARGETS = json.loads(os.environ["TARGETS"])   # {"myapp": [12, 3]}
DEBOUNCE = float(os.environ.get("DEBOUNCE_SECONDS", "5"))
CTX = ssl._create_unverified_context() if os.environ.get("INSECURE_TLS") == "1" else None
timers, lock = {}, threading.Lock()

def api(method, path, body=None):
    req = urllib.request.Request(
        P + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-API-Key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
        return json.load(r)

def redeploy(repo):
    sid, eid = TARGETS[repo]
    try:
        stack = api("GET", f"/api/stacks/{sid}")
        content = api("GET", f"/api/stacks/{sid}/file")["StackFileContent"]
        api("PUT", f"/api/stacks/{sid}?endpointId={eid}", {
            "stackFileContent": content,
            "env": stack.get("Env") or [],
            "prune": False,
            "pullImage": True,
        })
        print(f"redeployed {repo} (stack {sid})", flush=True)
    except Exception as e:
        print(f"redeploy FAILED for {repo}: {e}", flush=True)

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode(errors="replace")
        token = self.headers.get("X-Deploy-Token", "")
        if not hmac.compare_digest(token, SECRET):
            self.send_response(401); self.end_headers(); return
        print("ce-type:", self.headers.get("ce-type"), "\n", body, flush=True)  # discovery logging
        for repo in TARGETS:
            if f'"{repo}"' in body:   # crude match; tighten after seeing a real payload
                with lock:
                    if repo in timers: timers[repo].cancel()
                    timers[repo] = threading.Timer(DEBOUNCE, redeploy, [repo])
                    timers[repo].start()
        self.send_response(202); self.end_headers()

HTTPServer(("", 8080), H).serve_forever()
```

```dockerfile
FROM python:3.13-alpine
COPY deployer.py /app/deployer.py
CMD ["python", "-u", "/app/deployer.py"]
```

Compose sketch (same Docker network as zot and Portainer):

```yaml
services:
  deployer:
    build: .
    restart: unless-stopped
    environment:
      PORTAINER_URL: https://portainer:9443   # or http://portainer:9000 if enabled
      INSECURE_TLS: "1"                       # only needed for the self-signed 9443 endpoint
      PORTAINER_TOKEN: ${PORTAINER_TOKEN}
      DEPLOY_SECRET: ${DEPLOY_SECRET}
      TARGETS: '{"deploytest": [18, 3]}'
```

The receiver should not publish any ports to the host.

## 8. Implementation checklist

1. **Housekeeping:** revoke the access token that was pasted in plain text during testing. Create a dedicated low-privilege Portainer user and an access token for the receiver.
2. **Confirm** stack 18 still looks normal and editable in the Portainer UI.
3. **Decide TLS:** use plain HTTP port 9000 on the internal network if enabled, otherwise `INSECURE_TLS=1`.
4. **Deploy the receiver** on the shared network with `TARGETS` set to `deploytest` only. Confirm it starts and returns 401 without the token.
5. **Enable zot events** pointing at the receiver. Push a test image (amd64) and capture the real `ce-type` and payload from the receiver logs.
6. **Tighten the match** (repo name and tag, correct event type) based on the observed payload.
7. **End-to-end test:** push to zot, observe the receiver log, and confirm the `deploytest` container is recreated with the new image and env intact.
8. **Roll out** by adding real repos to `TARGETS` one at a time. Verify env preservation on `ntfy` specifically (compare its env list in the UI before and after).
9. **CI:** no workflow changes needed beyond pushing to the registry (`:latest` tag). Optional later: SHA tags with an `IMAGE_TAG` stack env var updated by the receiver.

## 9. Risks and notes

- **Payload shape unknown** until step 5; the crude substring match could over- or under-trigger.
- **Duplicate events:** zot may emit several events per push; the debounce coalesces them but should be tuned.
- **Silent failure:** the receiver only logs errors. Consider a notification to the existing `ntfy` instance on failure.
- **Rollback:** `:latest` has no built-in rollback. Redeploy an older digest/tag manually from the Portainer UI, or adopt SHA tags later.
- **Token scope:** a Portainer API token inherits its user's permissions, so keep the receiver's user minimal.
- **API field names** (`pullImage`, `env`) were validated empirically on this Portainer version; re-test after Portainer upgrades.
- **Aside:** several stacks set `TZ=AMERICA/EDMONTON`. Timezone names are case-sensitive on Linux; the correct value is `America/Edmonton`.
- **Sources caveat:** Portainer API details came from blog posts of mixed quality plus our own tests; the tests above are the authority.
