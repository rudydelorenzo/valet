# Deploy Hook API

The CI-facing endpoints under `/api/deploy`. All are authenticated by the secret token in the URL path — no headers required.

## `POST /api/deploy/{token}`

Enqueue a deploy. Pre-flight-checks the instance and stack (including that
the stack is not inactive — deploys to inactive stacks are refused), then
returns immediately. Deploys are bounded by the webhook's deploy timeout
(see the webhook settings): once the event is claimed for processing, if
the stack has not reported a successful deploy within that window the
event is marked failed with a `timed out` message. Time spent waiting in
the queue does not count against the window.

```json
{
  "received": true,
  "eventId": "evt_…",
  "deployUrl": "https://valet.example.com/api/deploy/{token}",
  "statusUrl": "https://valet.example.com/api/deploy/{token}/status/evt_…"
}
```

| Status | Meaning |
| --- | --- |
| `200` | Accepted — deploy queued |
| `403` | Hook is disabled |
| `404` | Unknown token |
| `424` | Portainer instance or stack unreachable/missing |

## `GET /api/deploy/{token}/status/{eventId}`

Poll deploy progress. With `Accept: text/plain` you get just the status word; otherwise JSON:

```json
{ "status": "running", "message": "optional detail" }
```

| Status | Meaning |
| --- | --- |
| `200` | `success` |
| `202` | `queued` or `running` — keep polling |
| `502` | `error` — see `message` |
| `404` | Unknown token or event |
