# Deploy Hook API

The CI-facing endpoints under `/api/deploy`. All are authenticated by the secret token in the URL path — no headers required.

## `POST /api/deploy/{token}`

Enqueue a deploy. Pre-flight-checks the instance and stack, then returns immediately.

```json
{
  "received": true,
  "eventId": "evt_…",
  "deployUrl": "https://valet.example.com/api/deploy/{token}",
  "statusUrl": "https://valet.example.com/api/deploy/{token}/status/evt_…",
  "eventUrl": "https://valet.example.com/api/deploy/{token}/events/evt_…"
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

## `GET /api/deploy/{token}/events/{eventId}`

Full event details (status, trigger source, timestamps, error message).
